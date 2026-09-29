import { NextRequest } from 'next/server';
import db from '@/lib/db';
import { buildOrderDetail } from '@/lib/order-view';
import { authenticate, getRequestId } from '@/lib/auth';
import { ok, unauthorized, notFound, handleError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: Params) {
  const requestId = getRequestId(request);

  try {
    const claims = authenticate(request);
    if (!claims) return unauthorized();

    const { id } = await params;
    const sub = String(claims.sub);

    const order = await db.order.findUnique({
      where: { id },
      select: { buyerId: true, sellerId: true },
    });

    if (!order || (order.buyerId !== sub && order.sellerId !== sub)) {
      return notFound('Order');
    }

    return ok(await buildOrderDetail(id));
  } catch (err) {
    return handleError(err, 'GET /api/v1/orders/[id]', requestId);
  }
}
