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

export async function releasePayout(orderId: string): Promise<PayoutStatus> {
  return db.$transaction(async (tx) => {

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

    if (order.status !== 'Completed') {
      throw new Error(`Order ${orderId} is not Completed (status: ${order.status})`);
    }

    if (order.orderEvents.length > 0) { // belt-and-braces: scan history even though status gates first
      throw new PayoutFrozenError(orderId);
    }

    const claim = await tx.order.updateMany({
      where: { id: orderId, payoutClaimedAt: null }, // atomic check-and-set: double-clicks and retries hit 0 rows
      data:  { payoutClaimedAt: new Date() },
    });

    if (claim.count === 0) {
      logger.info('Payout already claimed — idempotent no-op', { orderId });

      return buildPayoutStatus(order.payouts);
    }

    const seller = order.seller;
    if (!seller?.settlementBank || !seller?.settlementNumber) {

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
    const logisticsRef  = `payout_${orderId}_logistics`; // deterministic refs: Monnify dedupes by reference on retry

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
