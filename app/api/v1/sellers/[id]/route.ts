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

    const rating = await db.rating.aggregate({
      where: { sellerId: id },
      _avg: { stars: true },
      _count: { _all: true },
    });

    return ok({
      id: seller.id,
      business_name: seller.businessName,
      reputation,
      rating: { average: rating._avg.stars, count: rating._count._all },
    });
  } catch (err) {
    return handleError(err, 'GET /api/v1/sellers/[id]', requestId);
  }
}
