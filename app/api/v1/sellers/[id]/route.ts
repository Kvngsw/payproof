/**
 * app/api/v1/sellers/[id]/route.ts — Public seller profile + reputation (E06).
 *
 * GET — public. `{ id, business_name, reputation: { score, completed, total,
 * badge } }`. Reputation is computed live from real order history — never
 * hardcoded, never cached (spec INT-05).
 */

import { NextRequest } from 'next/server';
import db from '@/lib/db';
import { getReputation } from '@/lib/reputation';
import { getRequestId } from '@/lib/auth';
import { ok, notFound, handleError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: Params) {
  const requestId = getRequestId(request);

  try {
    const { id } = await params;
    const seller = await db.seller.findUnique({
      where: { id },
      select: { id: true, businessName: true, name: true },
    });

    if (!seller) return notFound('Seller');

    const reputation = await getReputation(id);

    return ok({
      id: seller.id,
      business_name: seller.businessName,
      reputation,
    });
  } catch (err) {
    return handleError(err, 'GET /api/v1/sellers/[id]', requestId);
  }
}
