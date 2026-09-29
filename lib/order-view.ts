import db from './db';
import { getReputation } from './reputation';
import { NotFoundError } from './errors';

const DISPLAY: Record<string, string> = {
  PendingPayment: 'Pending Payment',
  Paid: 'Paid',
  AwaitingShipment: 'Awaiting Shipment',
  Shipped: 'Shipped',
  Delivered: 'Delivered',
  Completed: 'Completed',
  Cancelled: 'Cancelled',
  Disputed: 'Disputed',
};

export function displayStatus(status: string): string {
  return DISPLAY[status] ?? status; // unknown future states pass through, never blank
}

export async function buildOrderDetail(orderId: string) {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: {
      product: { select: { id: true, name: true, imageUrl: true } },
      seller: { select: { id: true, businessName: true } },
      buyer: { select: { name: true, email: true, createdAt: true } },
      payments: { orderBy: { createdAt: 'desc' }, take: 1 },
      payouts: true,
      orderEvents: { orderBy: { createdAt: 'asc' } },
      rating: { select: { stars: true } },
    },
  });

  if (!order) throw new NotFoundError('Order');

  const reputation = await getReputation(order.sellerId);
  const payment = order.payments[0];
  const buyerOrderCount = order.buyerId
    ? await db.order.count({ where: { buyerId: order.buyerId } })
    : 0;

  const payoutStatus =
    order.status === 'Disputed'
      ? 'frozen'
      : order.payouts.length === 0
        ? 'none'
        : order.payouts.every((p) => p.status === 'paid')
          ? 'paid'
          : order.payouts.some((p) => p.status === 'held')
            ? 'partial'
            : 'pending';

  return {
    id: order.id,
    status: order.status,
    display_status: displayStatus(order.status),
    rating: order.rating?.stars ?? null,
    product: order.product,
    seller: {
      id: order.seller.id,
      business_name: order.seller.businessName,
      reputation,
    },
    buyer: order.buyer
      ? {
          name: order.buyer.name ?? order.buyer.email,
          email: order.buyer.email,
          created_at: order.buyer.createdAt,
          order_count: buyerOrderCount,
        }
      : null,
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
      display_from: displayStatus(e.fromStatus),
      display_to: displayStatus(e.toStatus),
      actor: e.actor,
      note: e.note,
      at: e.createdAt,
    })),
    updated_at: order.updatedAt,
  };
}
