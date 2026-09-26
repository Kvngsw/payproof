/**
 * app/api/v1/orders/[id]/confirm-delivery/route.ts — Buyer confirms (E19).
 *
 * POST — buyer (owner). `Delivered → Completed`, or atomically
 * `Shipped → Delivered → Completed` (two events). Triggers `releasePayout()`
 * — the dual transfer (product → seller, dispatch → logistics).
 */

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

    // E19 shortcut: Shipped → Delivered → Completed atomically.
    await db.$transaction(async (tx) => {
      if (order.status === 'Shipped') {
        await transition(order.id, 'Delivered', 'buyer', 'Buyer confirmed from Shipped', tx);
      }
      await transition(order.id, 'Completed', 'buyer', 'Buyer confirmed delivery', tx);
    });

    logger.info('Order completed by buyer', { orderId: order.id, requestId });

    // Release dual payout OUTSIDE the state txn (external rail calls).
    const payout = await releasePayout(order.id);

    return ok({ id: order.id, status: 'Completed', payout });
  } catch (err) {
    return handleError(err, 'POST /api/v1/orders/[id]/confirm-delivery', requestId);
  }
}
