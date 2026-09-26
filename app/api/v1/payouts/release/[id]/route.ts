import { NextRequest } from 'next/server';
import db from '@/lib/db';
import { logger } from '@/lib/logger';
import { authenticate, getRequestId } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limit';
import { releasePayout } from '@/lib/payout-service';
import {
  ok,
  unauthorized,
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

    const { allowed, retryAfterMs } = await checkRateLimit(`act:release:${claims.sub}`, 10, 60_000);
    if (!allowed) return tooManyRequestsResponse(retryAfterMs);

    const { id } = await params;
    const sub = String(claims.sub);

    const order = await db.order.findUnique({ where: { id } });
    if (!order || (order.buyerId !== sub && order.sellerId !== sub)) {
      return notFound('Order');
    }

    const payout = await releasePayout(order.id); // idempotent: safe retry when auto-release died mid-flight

    logger.info('Payout released (manual trigger)', {
      orderId: order.id,
      status: payout.status,
      requestId,
    });

    return ok({ order_id: order.id, ...payout });
  } catch (err) {
    return handleError(err, 'POST /api/v1/payouts/release/[id]', requestId);
  }
}
