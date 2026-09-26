import { z } from 'zod';
import { NextRequest } from 'next/server';
import db from '@/lib/db';
import { authenticate, getRequestId } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limit';
import { askAssistant } from '@/lib/assistant';
import {
  ok,
  badRequest,
  unauthorized,
  notFound,
  handleError,
  tooManyRequestsResponse,
} from '@/lib/api-response';

export const dynamic = 'force-dynamic';

const BodySchema = z.object({
  message: z.string().trim().min(1, 'message is required').max(1000, 'message must be ≤ 1000 characters'),
});

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: Params) {
  const requestId = getRequestId(request);

  try {
    const claims = authenticate(request);
    if (!claims) return unauthorized();

    const { allowed, retryAfterMs } = await checkRateLimit(`assistant:${claims.sub}`, 15, 60_000); // model calls cost money: never unbounded
    if (!allowed) {
      return tooManyRequestsResponse(retryAfterMs);
    }

    const { id } = await params;
    const sub = String(claims.sub);

    const order = await db.order.findUnique({
      where: { id },
      include: {
        product: { select: { name: true } },
        payments: { orderBy: { createdAt: 'desc' }, take: 1 },
        payouts: true,
        orderEvents: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!order || (order.buyerId !== sub && order.sellerId !== sub)) {
      return notFound('Order');
    }

    const raw = await request.json().catch(() => null);
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      return badRequest(parsed.error.issues[0].message);
    }

    const snapshot = {
      id: order.id,
      status: order.status,
      product: order.product.name,
      amounts_kobo: {
        product: order.productPriceKobo,
        dispatch: order.dispatchFeeKobo,
        total: order.totalKobo,
      },
      delivery_days: order.deliveryDays,
      tracking: {
        status: order.trackingStatus,
        number: order.trackingNumber,
        source: order.trackingSource,
      },
      payment: order.payments[0]
        ? {
            provider: order.payments[0].provider,
            verification_mode: order.payments[0].verificationMode,
            paid_at: order.payments[0].paidAt,
          }
        : null,
      payout: order.payouts.map((p) => ({ to: p.recipientType, status: p.status })),
      fraud_flag: order.fraudFlag,
      events: order.orderEvents.map((e) => ({
        from: e.fromStatus,
        to: e.toStatus,
        actor: e.actor,
        at: e.createdAt,
      })),
    };

    const result = await askAssistant(snapshot, parsed.data.message);
    return ok(result);
  } catch (err) {
    return handleError(err, 'POST /api/v1/orders/[id]/assistant', requestId);
  }
}
