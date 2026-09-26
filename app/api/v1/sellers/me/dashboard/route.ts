/**
 * app/api/v1/sellers/me/dashboard/route.ts — Seller dashboard (E07).
 *
 * GET — seller. `{ reserved_account, counts_by_status, payouts: {
 * pending_kobo, paid_kobo, frozen_kobo } }`.
 */

import { NextRequest } from 'next/server';
import db from '@/lib/db';
import { authenticate, getRequestId } from '@/lib/auth';
import { ok, unauthorized, forbidden, handleError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);

  try {
    const claims = authenticate(request);
    if (!claims) return unauthorized();
    if (claims.role !== 'seller') return forbidden('Only sellers have dashboards.');

    const sellerId = String(claims.sub);

    const seller = await db.seller.findUnique({
      where: { id: sellerId },
      select: {
        reservedAccountNumber: true,
        reservedBankName: true,
        reservedAccountName: true,
      },
    });

    if (!seller) return unauthorized('Session expired. Please log in again.');

    const counts = await db.order.groupBy({
      by: ['status'],
      where: { sellerId },
      _count: { status: true },
    });

    const countsByStatus: Record<string, number> = {};
    for (const row of counts) {
      countsByStatus[row.status] = row._count.status;
    }

    const payoutSums = await db.payout.groupBy({
      by: ['status'],
      where: { order: { sellerId } },
      _sum: { amountKobo: true },
    });

    let pendingKobo = 0;
    let paidKobo = 0;
    let frozenKobo = 0;
    for (const row of payoutSums) {
      const sum = row._sum.amountKobo ?? 0;
      if (row.status === 'paid') paidKobo += sum;
      else if (row.status === 'held' || row.status === 'failed') frozenKobo += sum;
      else pendingKobo += sum;
    }

    return ok({
      reserved_account: seller.reservedAccountNumber
        ? {
            account_number: seller.reservedAccountNumber,
            bank_name: seller.reservedBankName,
            account_name: seller.reservedAccountName,
          }
        : null,
      counts_by_status: countsByStatus,
      payouts: {
        pending_kobo: pendingKobo,
        paid_kobo: paidKobo,
        frozen_kobo: frozenKobo,
      },
    });
  } catch (err) {
    return handleError(err, 'GET /api/v1/sellers/me/dashboard', requestId);
  }
}
