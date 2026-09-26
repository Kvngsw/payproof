import { NextRequest } from 'next/server';
import db from '@/lib/db';
import { logger } from '@/lib/logger';
import { authenticate, getRequestId } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limit';
import { transition } from '@/lib/order-service';
import { releasePayout } from '@/lib/payout-service';
import {
  ok,
  unauthorized,
  forbidden,
  notFound,
  handleError,
  tooManyRequestsResponse,
} from '@/lib/api-response';

export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: Params) {
  const requestId = getRequestId(request);

  try {
    const claims = authenticate(request);
    if (!claims) return unauthorized();
    if (claims.role !== 'buyer') return forbidden('Only the buyer can confirm delivery.');

    const { allowed, retryAfterMs } = await checkRateLimit(`act:confirm:${claims.sub}`, 20, 60_000);
    if (!allowed) return tooManyRequestsResponse(retryAfterMs);

    const { id } = await params;
    const order = await db.order.findUnique({ where: { id } });
    if (!order || order.buyerId !== String(claims.sub)) {
      return notFound('Order');
    }

    await db.$transaction(async (tx) => {
      if (order.status === 'Shipped') { // E19 shortcut: two transitions, one atomic txn
        await transition(order.id, 'Delivered', 'buyer', 'Buyer confirmed from Shipped', tx);
      }
      await transition(order.id, 'Completed', 'buyer', 'Buyer confirmed delivery', tx);
    });

    logger.info('Order completed by buyer', { orderId: order.id, requestId });

    const payout = await releasePayout(order.id);

    return ok({ id: order.id, status: 'Completed', payout });
  } catch (err) {
    return handleError(err, 'POST /api/v1/orders/[id]/confirm-delivery', requestId);
  }
}
