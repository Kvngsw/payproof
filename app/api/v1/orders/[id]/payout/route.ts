/**
 * app/api/v1/orders/[id]/payout/route.ts — Payout status view (E21).
 *
 * GET — party only. `{ status, product_kobo, dispatch_kobo, transfers: [{
 * to, amount_kobo, status, ref }] }`. `status`: none | pending | paid |
 * frozen | partial | failed. Disputed orders report `frozen`.
 */

import { NextRequest } from 'next/server';
import db from '@/lib/db';
import { authenticate, getRequestId } from '@/lib/auth';
import { ok, unauthorized, notFound, handleError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: Params) {
  const requestId = getRequestId(request);

  try {
    const claims = authenticate(request);
    if (!claims) return unauthorized();

    const { id } = await params;
    const sub = String(claims.sub);

    const order = await db.order.findUnique({
      where: { id },
      include: { payouts: true },
    });

    if (!order || (order.buyerId !== sub && order.sellerId !== sub)) {
      return notFound('Order');
    }

    let status = 'none';
    if (order.status === 'Disputed') {
      status = 'frozen';
    } else if (order.payouts.length > 0) {
      status = order.payouts.every((p) => p.status === 'paid')
        ? 'paid'
        : order.payouts.some((p) => p.status === 'held' || p.status === 'failed')
          ? 'partial'
          : 'pending';
    }

    return ok({
      status,
      product_kobo: order.productPriceKobo,
      dispatch_kobo: order.dispatchFeeKobo,
      transfers: order.payouts.map((p) => ({
        to: p.recipientType,
        amount_kobo: p.amountKobo,
        status: p.status,
        ref: p.transferRef,
      })),
    });
  } catch (err) {
    return handleError(err, 'GET /api/v1/orders/[id]/payout', requestId);
  }
}
