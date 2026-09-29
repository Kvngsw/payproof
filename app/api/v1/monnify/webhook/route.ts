import { z } from 'zod';
import { NextRequest } from 'next/server';
import db from '@/lib/db';
import { logger } from '@/lib/logger';
import { getRequestId } from '@/lib/auth';
import {
  isSandbox,
  verifyWebhookSignature,
  verifyTransaction,
} from '@/lib/monnify';
import {
  transition,
  decrementStock,
  findOrderByReference,
  runFraudCheck,
} from '@/lib/order-service';
import { appError } from '@/lib/api-response';
import { BadSignatureError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

const ACK = () => new Response('OK', { status: 200 });

const EventDataSchema = z
  .object({
    transactionReference: z.string().min(1),
    paymentReference: z.string().min(1),
    amountPaid: z.union([z.string(), z.number()]).nullable().optional(),
    paymentStatus: z.string().nullable().optional(),
  })
  .passthrough();

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);

  let rawBody: string;
  let payload: {
    eventType?: string;
    eventData?: unknown;
  };

  try {
    rawBody = await request.text(); // HMAC needs raw bytes: no JSON middleware before verify
    payload = JSON.parse(rawBody);
  } catch {
    logger.warn('Webhook: unparseable body — ACK to avoid retry storm', { requestId });
    return ACK();
  }

  const sandbox = isSandbox();

  if (!sandbox) {
    const signature = request.headers.get('monnify-signature');
    if (!signature || !verifyWebhookSignature(rawBody, signature)) {
      logger.warn('Webhook: bad signature', { requestId });
      return appError(new BadSignatureError(), requestId);
    }
  }

  const { eventType, eventData: rawEventData } = payload;

  if (eventType !== 'SUCCESSFUL_TRANSACTION') {
    return ACK();
  }

  const parsedEvent = EventDataSchema.safeParse(rawEventData);
  if (!parsedEvent.success) {
    logger.warn('Webhook: malformed eventData — ACK without processing', { requestId });
    return ACK();
  }
  const eventData = parsedEvent.data;

  const paymentRef = eventData.paymentReference;

  const transactionRef = eventData.transactionReference;

  try {
    await db.webhookEvent.create({
      data: { id: transactionRef, processed: false, payload: eventData as object },
    });
  } catch (err: unknown) {
    if ((err as { code?: string }).code === 'P2002') {
      const existing = await db.webhookEvent.findUnique({ where: { id: transactionRef } });
      if (existing && !existing.processed) {
        logger.warn('Webhook: previous invocation crashed — re-processing', {
          transactionRef,
          requestId,
        });
        await db.webhookEvent.delete({ where: { id: transactionRef } }).catch(() => {});
        try {
          await db.webhookEvent.create({
            data: { id: transactionRef, processed: false, payload: eventData as object },
          });
        } catch {
          logger.error('Webhook: re-claim failed', { transactionRef, requestId });
          return ACK();
        }
      } else {
        logger.info('Webhook: duplicate ignored (already processed)', {
          transactionRef,
          requestId,
        });
        return ACK();
      }
    } else {
      throw err;
    }
  }

  // ACK first: slow webhooks get retried by Monnify, so claim-then-respond
  const processing = handleNotification(String(paymentRef), String(transactionRef), requestId);

  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    processing.catch((err) => {
      logger.error('Webhook: background processing failed', {
        transactionRef,
        err,
        requestId,
      });
    });
  } else {
    await processing;
  }

  return ACK();
}

async function removeClaim(transactionRef: string) {
  await db.webhookEvent.delete({ where: { id: transactionRef } }).catch(() => {});
}

async function markProcessed(transactionRef: string) {
  await db.webhookEvent.update({
    where: { id: transactionRef },
    data: { processed: true },
  }).catch(() => {});
}

async function handleNotification(paymentRef: string, transactionRef: string, requestId: string) {
  try {
    const order = await findOrderByReference(paymentRef);

    if (!order) {
      logger.warn('Webhook: no order for paymentReference', { paymentRef, transactionRef, requestId });
      await markProcessed(transactionRef);
      return;
    }

    if (order.status !== 'PendingPayment') {
      logger.info('Webhook: order not pending — replay ignored', {
        orderId: order.id,
        status: order.status,
        transactionRef,
        requestId,
      });
      await markProcessed(transactionRef);
      return;
    }

    if (!order.payments?.[0]?.providerRef) {
      await db.payment
        .update({ where: { reference: paymentRef }, data: { providerRef: transactionRef } })
        .catch(() => {});
    }

    let verified: Awaited<ReturnType<typeof verifyTransaction>>;
    try {
      verified = await verifyTransaction(transactionRef); // never trust the body: server-side truth only
    } catch (err) {
      logger.error('Webhook: verify call failed — claim removed for retry', {
        orderId: order.id,
        transactionRef,
        err,
        requestId,
      });
      await removeClaim(transactionRef);
      return;
    }

    const isPaid = verified.paymentStatus === 'PAID';

    if (!isPaid || verified.amountKobo !== order.totalKobo || verified.currency !== 'NGN') {
      logger.warn('Webhook: PAYMENT_MISMATCH — order stays PendingPayment', {
        orderId: order.id,
        paymentStatus: verified.paymentStatus,
        verifiedKobo: verified.amountKobo,
        expectedKobo: order.totalKobo,
        currency: verified.currency,
        transactionRef,
        requestId,
      });
      await db.orderEvent.create({
        data: {
          orderId: order.id,
          fromStatus: 'PendingPayment',
          toStatus: 'PendingPayment', // stay put but leave an audit trail
          actor: 'system',
          note: `PAYMENT_MISMATCH status=${verified.paymentStatus} amount=${verified.amountKobo} expected=${order.totalKobo}`,
        },
      });
      await markProcessed(transactionRef);
      return;
    }

    try {
      await db.$transaction(async (tx) => {
        await tx.payment.update({
          where: { reference: paymentRef },
          data: {
            status: 'paid',
            amountKobo: verified.amountKobo,
            raw: verified.raw as object,
            paidAt: verified.paidAt ? new Date(verified.paidAt) : new Date(),
            verificationMode: 'live',
          },
        });

        await decrementStock(order.productId, tx);

        await transition(order.id, 'Paid', 'system', `Monnify ref ${transactionRef}`, tx);
        await transition(order.id, 'AwaitingShipment', 'system', undefined, tx);

        const fraud = await runFraudCheck(order.sellerId, order.totalKobo);
        await tx.order.update({
          where: { id: order.id },
          data: { fraudFlag: fraud as unknown as object },
        });

        await tx.webhookEvent.update({
          where: { id: transactionRef },
          data: { processed: true },
        });
      });

      logger.info('Webhook: order Paid → AwaitingShipment', {
        orderId: order.id,
        transactionRef,
        amountKobo: verified.amountKobo,
        requestId,
      });
    } catch (err) {
      logger.error('Webhook: atomic txn failed — claim removed for retry', {
        orderId: order.id,
        transactionRef,
        err,
        requestId,
      });
      await removeClaim(transactionRef);
    }
  } catch (err) {
    logger.error('Webhook: unexpected failure — marking processed to stop retry loop', {
      transactionRef,
      err,
      requestId,
    });
    await markProcessed(transactionRef);
  }
}
