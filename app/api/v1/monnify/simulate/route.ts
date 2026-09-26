import { z } from 'zod';
import { NextRequest } from 'next/server';
import db from '@/lib/db';
import { logger } from '@/lib/logger';
import { env } from '@/lib/env';
import { getRequestId } from '@/lib/auth';
import { isSandbox } from '@/lib/monnify';
import {
  transition,
  decrementStock,
  findOrderByReference,
  runFraudCheck,
} from '@/lib/order-service';
import {
  ok,
  badRequest,
  forbidden,
  handleError,
} from '@/lib/api-response';

export const dynamic = 'force-dynamic';

const BodySchema = z.object({
  payment_reference: z.string().min(1, 'payment_reference is required'),
});

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);

  try {
    if (!isSandbox() || env.NODE_ENV === 'production') { // rehearsal tool only: must never exist in production
      return forbidden('Simulator is sandbox-only.');
    }

    const raw = await request.json().catch(() => null);
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      return badRequest(parsed.error.issues[0].message);
    }

    const order = await findOrderByReference(parsed.data.payment_reference);
    if (!order) {
      return badRequest('No order found for payment_reference.');
    }
    if (order.status !== 'PendingPayment') {
      return badRequest(`Order is ${order.status}, not PendingPayment.`);
    }

    await db.$transaction(async (tx) => {
      await tx.payment.update({
        where: { reference: parsed.data.payment_reference },
        data: {
          status: 'paid',
          amountKobo: order.totalKobo,
          paidAt: new Date(),
          verificationMode: 'live-simulated',
        },
      });
      await decrementStock(order.productId, tx);
      await transition(order.id, 'Paid', 'system', 'SIMULATED payment (sandbox)', tx);
      await transition(order.id, 'AwaitingShipment', 'system', undefined, tx);
      const fraud = await runFraudCheck(order.sellerId, order.totalKobo);
      await tx.order.update({
        where: { id: order.id },
        data: { fraudFlag: fraud as unknown as object },
      });
    });

    logger.warn('SIMULATED payment applied (sandbox)', {
      orderId: order.id,
      requestId,
    });

    return ok({ id: order.id, status: 'AwaitingShipment', simulated: true });
  } catch (err) {
    return handleError(err, 'POST /api/v1/monnify/simulate', requestId);
  }
}
