import { NextRequest } from 'next/server';
import db from '@/lib/db';
import { logger } from '@/lib/logger';
import { authenticate, getRequestId } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limit';
import { transition } from '@/lib/order-service';
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
    if (claims.role !== 'buyer') return forbidden('Only the buyer can cancel this order.');

    const { allowed, retryAfterMs } = await checkRateLimit(`act:cancel:${claims.sub}`, 20, 60_000);
    if (!allowed) return tooManyRequestsResponse(retryAfterMs);

    const { id } = await params;
    const order = await db.order.findUnique({ where: { id } });
    if (!order || order.buyerId !== String(claims.sub)) {
      return notFound('Order');
    }

    await transition(order.id, 'Cancelled', 'buyer', 'Cancelled before payment');

    logger.info('Order cancelled', { orderId: order.id, requestId });
    return ok({ id: order.id, status: 'Cancelled' });
  } catch (err) {
    return handleError(err, 'POST /api/v1/orders/[id]/cancel', requestId);
  }
}
