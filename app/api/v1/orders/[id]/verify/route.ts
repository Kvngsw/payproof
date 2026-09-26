import { NextRequest } from 'next/server';
import db from '@/lib/db';
import { logger } from '@/lib/logger';
import { env } from '@/lib/env';
import { authenticate, getRequestId } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limit';
import { verifyTransaction } from '@/lib/monnify';
import { transition, decrementStock, runFraudCheck } from '@/lib/order-service';
import {
  ok,
  unauthorized,
  forbidden,
  notFound,
  handleError,
  tooManyRequestsResponse,
} from '@/lib/api-response';
import { RailTimeoutError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: Params) {
  const requestId = getRequestId(request);

  try {
    const claims = authenticate(request);
    if (!claims) return unauthorized();
    if (claims.role !== 'buyer') return forbidden('Only the buyer can verify this order.');

    const { allowed, retryAfterMs } = await checkRateLimit(`act:verify:${claims.sub}`, 10, 60_000);
    if (!allowed) return tooManyRequestsResponse(retryAfterMs);

    const { id } = await params;
    const order = await db.order.findUnique({
      where: { id },
      include: { payments: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    if (!order || order.buyerId !== String(claims.sub)) {
      return notFound('Order');
    }

    const payment = order.payments[0];
    if (!payment) return notFound('Payment');

    if (order.status !== 'PendingPayment') {
      return ok({ id: order.id, status: order.status, verification_mode: payment.verificationMode });
    }

    let verified: Awaited<ReturnType<typeof verifyTransaction>>;
    try {

      verified = await verifyTransaction(payment.providerRef ?? payment.reference);
    } catch (err) {

      if (err instanceof RailTimeoutError && env.DEMO_FALLBACK) { // disclosed fallback: cached state plus banner, never silent success
        await db.payment.update({
          where: { id: payment.id },
          data: { verificationMode: 'cached_fallback' },
        });
        logger.warn('Verify: rail timeout — cached fallback', {
          orderId: order.id,
          requestId,
        });
        return ok({
          id: order.id,
          status: order.status,
          verification_mode: 'cached_fallback',
          banner: 'Verification delayed — using cached confirmation.',
        });
      }
      throw err;
    }

    if (
      verified.paymentStatus !== 'PAID' ||
      verified.amountKobo !== order.totalKobo ||
      verified.currency !== 'NGN'
    ) {
      return ok({
        id: order.id,
        status: order.status,
        verification_mode: 'live',
        verified: false,
      });
    }

    await db.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: 'paid',
          amountKobo: verified.amountKobo,
          raw: verified.raw as object,
          paidAt: verified.paidAt ? new Date(verified.paidAt) : new Date(),
          verificationMode: 'live',
        },
      });
      await decrementStock(order.productId, tx);
      await transition(order.id, 'Paid', 'system', 'Live verify (buyer-triggered)', tx);
      await transition(order.id, 'AwaitingShipment', 'system', undefined, tx);
      const fraud = await runFraudCheck(order.sellerId, order.totalKobo);
      await tx.order.update({
        where: { id: order.id },
        data: { fraudFlag: fraud as unknown as object },
      });
    });

    logger.info('Verify: order advanced via live check', { orderId: order.id, requestId });
    return ok({ id: order.id, status: 'AwaitingShipment', verification_mode: 'live', verified: true });
  } catch (err) {
    return handleError(err, 'POST /api/v1/orders/[id]/verify', requestId);
  }
}
