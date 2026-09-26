/**
 * app/api/v1/payouts/release/[id]/route.ts — Manual payout release.
 *
 * POST — party only (buyer or seller). Order must be Completed; Disputed
 * history or a prior claim → 409. Idempotent: repeat calls return existing
 * status. Normally triggered automatically by confirm-delivery; this endpoint
 * covers retries when the auto-release failed mid-flight.
 */

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

    // Tightest budget: fires real rail transfers. Idempotent, but bounded.
    const { allowed, retryAfterMs } = await checkRateLimit(`act:release:${claims.sub}`, 10, 60_000);
    if (!allowed) return tooManyRequestsResponse(retryAfterMs);

    const { id } = await params;
    const sub = String(claims.sub);

    const order = await db.order.findUnique({ where: { id } });
    if (!order || (order.buyerId !== sub && order.sellerId !== sub)) {
      return notFound('Order');
    }

    const payout = await releasePayout(order.id);

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
