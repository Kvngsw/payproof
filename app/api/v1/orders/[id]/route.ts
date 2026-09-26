import { NextRequest } from 'next/server';
import db from '@/lib/db';
import { getReputation } from '@/lib/reputation';
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
      include: {
        product: { select: { id: true, name: true, imageUrl: true } },
        seller: { select: { id: true, businessName: true } },
        payments: { orderBy: { createdAt: 'desc' }, take: 1 },
        payouts: true,
        orderEvents: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!order || (order.buyerId !== sub && order.sellerId !== sub)) {
      return notFound('Order');
    }

    const reputation = await getReputation(order.sellerId);
    const payment = order.payments[0];

    const payoutStatus =
      order.payouts.length === 0
        ? 'none'
        : order.payouts.every((p) => p.status === 'paid')
          ? 'paid'
          : order.payouts.some((p) => p.status === 'held')
            ? 'partial'
            : 'pending';

    return ok({
      id: order.id,
      status: order.status,
      product: order.product,
      seller: {
        id: order.seller.id,
        business_name: order.seller.businessName,
        reputation,
      },
      amounts: {
        product_kobo: order.productPriceKobo,
        dispatch_fee_kobo: order.dispatchFeeKobo,
        total_kobo: order.totalKobo,
      },
      delivery_days: order.deliveryDays,
      delivery_address: order.deliveryAddress,
      tracking: {
        status: order.trackingStatus,
        number: order.trackingNumber,
        source: order.trackingSource ?? 'manual',

        label:
          (order.trackingSource ?? 'manual') === 'manual'
            ? 'Manually updated by seller'
            : null,
      },
      payment: payment
        ? {
            reference: payment.reference,
            provider: payment.provider,
            verification_mode: payment.verificationMode,
            paid_at: payment.paidAt,
          }
        : null,
      payout: {
        status: payoutStatus,
        transfers: order.payouts.map((p) => ({
          to: p.recipientType,
          amount_kobo: p.amountKobo,
          status: p.status,
          ref: p.transferRef,
        })),
      },
      fraud_flag: order.fraudFlag ?? { triggered: false, state: 'insufficient_history', label: 'Rule-based' },
      events: order.orderEvents.map((e) => ({
        from: e.fromStatus,
        to: e.toStatus,
        actor: e.actor,
        note: e.note,
        at: e.createdAt,
      })),
      updated_at: order.updatedAt,
    });
  } catch (err) {
    return handleError(err, 'GET /api/v1/orders/[id]', requestId);
  }
}
