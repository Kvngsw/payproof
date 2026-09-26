/**
 * app/api/v1/monnify/webhook/route.ts — Monnify payment webhook (E16).
 *
 * POST, public + HMAC signature. Always responds fast; processing is
 * idempotent and safe to retry.
 *
 * Pipeline (§7.6):
 *   1. Raw body (no JSON middleware) → verify HMAC-SHA512 via
 *      `monnify-signature` header (timingSafeEqual). Sandbox skips —
 *      Monnify sends no signature there. Prod failure → 401 BAD_SIGNATURE.
 *   2. Ignore non-SUCCESSFUL_TRANSACTION events → 200.
 *   3. Look up order by `eventData.paymentReference` (OUR ref from
 *      initializeTransaction) — NOT by (sellerId, amount). This is the fix
 *      for 1.0's critical misattribution bug.
 *   4. Atomic dedup via WebhookEvent (crash recovery: processed=false →
 *      re-process on retry).
 *   5. Respond 200 immediately after the claim is committed.
 *   6. Server-side verifyTransaction(reference) — never trust the body.
 *   7. One DB txn: payment → stock decrement (D10) → Paid → AwaitingShipment
 *      → fraud rule → events. Mismatch → stay PendingPayment + PAYMENT_MISMATCH
 *      event (permanent, no retry loop).
 */

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

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);

  let rawBody: string;
  let payload: {
    eventType?: string;
    eventData?: {
      transactionReference?: string;
      paymentReference?: string;
      amountPaid?: string | number;
      [key: string]: unknown;
    };
  };

  try {
    rawBody = await request.text();
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

  const { eventType, eventData } = payload;

  if (eventType !== 'SUCCESSFUL_TRANSACTION') {
    return ACK();
  }

  // OUR payment reference (set at initializeTransaction) — unique per order.
  const paymentRef = eventData?.paymentReference;
  // Monnify's own reference — dedup key + server-side verify key.
  const transactionRef = eventData?.transactionReference;

  if (!paymentRef || !transactionRef) {
    logger.error('Webhook: missing references in eventData', { eventData, requestId });
    return ACK();
  }

  // ── Atomic dedup claim (survives serverless kills) ─────────────────────────
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

  // Claim committed → ACK fast. Heavy work continues below.
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
  // ── Reference-keyed lookup (the 1.0 bug fix) ───────────────────────────────
  const order = await findOrderByReference(paymentRef);

  if (!order) {
    logger.warn('Webhook: no order for paymentReference', { paymentRef, transactionRef, requestId });
    await markProcessed(transactionRef); // permanent — retry won't create an order
    return;
  }

  // Idempotency: only PendingPayment orders advance. Anything else = replay.
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

  // ── Server-side verification (never trust the body) ────────────────────────
  // Backfill Monnify's transaction ref for rows created before providerRef.
  if (!order.payments?.[0]?.providerRef) {
    await db.payment
      .update({ where: { reference: paymentRef }, data: { providerRef: transactionRef } })
      .catch(() => {});
  }

  let verified: Awaited<ReturnType<typeof verifyTransaction>>;
  try {
    verified = await verifyTransaction(transactionRef);
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

  if (!isPaid || verified.amountKobo !== order.totalKobo || verified.currency !== 'NGN') {    logger.warn('Webhook: PAYMENT_MISMATCH — order stays PendingPayment', {
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
        toStatus: 'PendingPayment',
        actor: 'system',
        note: `PAYMENT_MISMATCH status=${verified.paymentStatus} amount=${verified.amountKobo} expected=${order.totalKobo}`,
      },
    });
    await markProcessed(transactionRef); // permanent — amounts won't change
    return;
  }

  // ── Atomic money txn ───────────────────────────────────────────────────────
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

      // D10: decrement stock on Paid, inside the same txn.
      await decrementStock(order.productId, tx);

      await transition(order.id, 'Paid', 'system', `Monnify ref ${transactionRef}`, tx);
      await transition(order.id, 'AwaitingShipment', 'system', undefined, tx);

      // Fraud rule (informational only, never blocks — D15).
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
}
