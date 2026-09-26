/**
 * lib/payout-service.ts — Payout split executor.
 *
 * WHY (two transfers): The dispatch fee is held in escrow alongside the
 * product price. When the buyer confirms delivery, we release two transfers:
 *   1. Product price → seller's settlement account
 *   2. Dispatch fee  → logistics partner account
 *
 * WHY (atomic claim lock): The payoutClaimedAt column is set before any
 * transfer fires. The updateMany({ where: { payoutClaimedAt: null } })
 * is an atomic check-and-set — only one request can claim it. A second
 * request (double-click, retry) hits 0 rows and is rejected.
 *
 * WHY (partial failure handling): If the second transfer (logistics) fails,
 * we record status='partial' and status='held' on the logistics payout row.
 * The UI shows "logistics fee held" — no silent success.
 *
 * WHY (unique transferRef): Each payout has a deterministic reference:
 *   payout_{orderId}_seller / payout_{orderId}_logistics
 * If the transfer succeeds but the DB write fails, re-sending the same
 * reference to Monnify is idempotent — they deduplicate by reference.
 */

import db from './db';
import { logger } from './logger';
import { initiatePayout } from './monnify';
import { splitPayout }   from './order-service';
import { PayoutFrozenError } from './errors';

export interface PayoutStatus {
  status:     'none' | 'pending' | 'paid' | 'partial' | 'frozen' | 'failed';
  transfers:  Array<{
    to:         'seller' | 'logistics';
    amountKobo: number;
    status:     string;
    ref:        string;
  }>;
}

/**
 * Release payouts for a Completed order.
 *
 * Guards:
 *   1. Order must be in Completed status
 *   2. No Disputed event in history (belt-and-braces check)
 *   3. payoutClaimedAt must be null (atomic idempotency guard)
 */
export async function releasePayout(orderId: string): Promise<PayoutStatus> {
  return db.$transaction(async (tx) => {
    // Load order with seller and payout history inside the transaction.
    const order = await tx.order.findUnique({
      where:   { id: orderId },
      include: {
        seller:      true,
        payments:    { take: 1, orderBy: { createdAt: 'desc' } },
        orderEvents: { where: { toStatus: 'Disputed' } },
        payouts:     true,
      },
    });

    if (!order) throw new Error(`Order ${orderId} not found`);

    // Guard 1 — must be Completed
    if (order.status !== 'Completed') {
      throw new Error(`Order ${orderId} is not Completed (status: ${order.status})`);
    }

    // Guard 2 — no Disputed event ever (belt-and-braces, spec §7.4)
    if (order.orderEvents.length > 0) {
      throw new PayoutFrozenError(orderId);
    }

    // Guard 3 — atomic claim
    const claim = await tx.order.updateMany({
      where: { id: orderId, payoutClaimedAt: null },
      data:  { payoutClaimedAt: new Date() },
    });

    if (claim.count === 0) {
      logger.info('Payout already claimed — idempotent no-op', { orderId });
      // Return existing payout status
      return buildPayoutStatus(order.payouts);
    }

    const seller = order.seller;
    if (!seller?.settlementBank || !seller?.settlementNumber) {
      // Release the claim so the seller can retry after adding settlement details.
      await tx.order.update({
        where: { id: orderId },
        data:  { payoutClaimedAt: null },
      });
      throw new Error('Seller has no settlement account configured.');
    }

    const sourceAccount = process.env.MONNIFY_WALLET_ACCOUNT_NUMBER!;
    const { sellerKobo, logisticsKobo } = splitPayout(
      order.productPriceKobo,
      order.dispatchFeeKobo,
    );

    const sellerRef     = `payout_${orderId}_seller`;
    const logisticsRef  = `payout_${orderId}_logistics`;

    // ── Transfer 1: product price → seller ───────────────────────────────────
    let sellerTransfer: { status: string; reference: string };
    try {
      sellerTransfer = await initiatePayout({
        amountKobo:               sellerKobo,
        reference:                sellerRef,
        narration:                `PayProof payout — product (order ${orderId})`,
        destinationBankCode:      seller.settlementBank,
        destinationAccountNumber: seller.settlementNumber,
        destinationAccountName:   seller.settlementName ?? '',
        sourceAccountNumber:      sourceAccount,
      });
    } catch (err) {
      // First transfer failed — release the claim so a retry is possible.
      await tx.order.update({
        where: { id: orderId },
        data:  { payoutClaimedAt: null },
      });
      throw err;
    }

    await tx.payout.create({
      data: {
        orderId,
        recipientType: 'seller',
        amountKobo:    sellerKobo,
        status:        sellerTransfer.status === 'SUCCESS' ? 'paid' : 'pending',
        transferRef:   sellerRef,
        raw:           sellerTransfer as object,
      },
    });

    logger.info('Seller payout sent', {
      orderId,
      ref: sellerRef,
      amountKobo: sellerKobo,
      status: sellerTransfer.status,
    });

    // ── Transfer 2: dispatch fee → logistics ──────────────────────────────────
    // D6: if this fails, record as HELD with status='partial'. Don't roll
    // back the seller transfer — the order is still Completed.
    const logisticsBankCode      = process.env.LOGISTICS_BANK_CODE!;
    const logisticsAccountNumber = process.env.LOGISTICS_ACCOUNT_NUMBER!;
    const logisticsAccountName   = process.env.LOGISTICS_ACCOUNT_NAME!;

    let logisticsStatus = 'held';
    let logisticsTransfer: { status: string; reference: string } | null = null;

    try {
      logisticsTransfer = await initiatePayout({
        amountKobo:               logisticsKobo,
        reference:                logisticsRef,
        narration:                `PayProof logistics fee (order ${orderId})`,
        destinationBankCode:      logisticsBankCode,
        destinationAccountNumber: logisticsAccountNumber,
        destinationAccountName:   logisticsAccountName,
        sourceAccountNumber:      sourceAccount,
      });
      logisticsStatus = logisticsTransfer.status === 'SUCCESS' ? 'paid' : 'pending';
    } catch (err) {
      // D6 fallback — logistics transfer failed, fee is HELD.
      logger.error('Logistics payout failed — fee held', { orderId, err });
      logisticsStatus = 'held';
    }

    await tx.payout.create({
      data: {
        orderId,
        recipientType: 'logistics',
        amountKobo:    logisticsKobo,
        status:        logisticsStatus,
        transferRef:   logisticsRef,
        raw:           logisticsTransfer as object,
      },
    });

    logger.info('Logistics payout handled', {
      orderId,
      ref: logisticsRef,
      amountKobo: logisticsKobo,
      status: logisticsStatus,
    });

    // Determine overall payout status
    const overallStatus =
      logisticsStatus === 'held' ? 'partial' : 'paid';

    return {
      status: overallStatus,
      transfers: [
        { to: 'seller',    amountKobo: sellerKobo,    status: sellerTransfer.status,   ref: sellerRef },
        { to: 'logistics', amountKobo: logisticsKobo, status: logisticsStatus, ref: logisticsRef },
      ],
    };
  });
}

function buildPayoutStatus(
  payouts: Array<{ recipientType: string; amountKobo: number; status: string; transferRef: string }>,
): PayoutStatus {
  if (!payouts.length) return { status: 'none', transfers: [] };

  const transfers = payouts.map((p) => ({
    to:         p.recipientType as 'seller' | 'logistics',
    amountKobo: p.amountKobo,
    status:     p.status,
    ref:        p.transferRef,
  }));

  const hasHeld    = transfers.some((t) => t.status === 'held');
  const allPaid    = transfers.every((t) => t.status === 'paid');
  const overallStatus = allPaid ? 'paid' : hasHeld ? 'partial' : 'pending';

  return { status: overallStatus, transfers };
}
