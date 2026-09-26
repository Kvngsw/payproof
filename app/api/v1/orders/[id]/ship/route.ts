import { z } from 'zod';
import { NextRequest } from 'next/server';
import db from '@/lib/db';
import { logger } from '@/lib/logger';
import { authenticate, getRequestId } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limit';
import { transition } from '@/lib/order-service';
import {
  ok,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  handleError,
  tooManyRequestsResponse,
} from '@/lib/api-response';

export const dynamic = 'force-dynamic';

const BodySchema = z.object({
  tracking_number: z.string().trim().min(3).optional(),
  carrier: z.string().trim().min(2).optional(),
});

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: Params) {
  const requestId = getRequestId(request);

  try {
    const claims = authenticate(request);
    if (!claims) return unauthorized();
    if (claims.role !== 'seller') return forbidden('Only the seller can ship this order.');

    const { allowed, retryAfterMs } = await checkRateLimit(`act:ship:${claims.sub}`, 30, 60_000);
    if (!allowed) return tooManyRequestsResponse(retryAfterMs);

    const { id } = await params;
    const order = await db.order.findUnique({ where: { id } });
    if (!order || order.sellerId !== String(claims.sub)) {
      return notFound('Order');
    }

    const raw = await request.json().catch(() => null);
    const parsed = BodySchema.safeParse(raw ?? {});
    if (!parsed.success) {
      return badRequest(parsed.error.issues[0].message);
    }

    await db.$transaction(async (tx) => {
      await transition(order.id, 'Shipped', 'seller', 'Seller marked as shipped', tx);
      await tx.order.update({
        where: { id: order.id },
        data: {
          trackingStatus: 'Picked Up',
          trackingSource: 'manual',
          ...(parsed.data.tracking_number && { trackingNumber: parsed.data.tracking_number }),
        },
      });
    });

    logger.info('Order shipped', { orderId: order.id, requestId });
    return ok({ id: order.id, status: 'Shipped' });
  } catch (err) {
    return handleError(err, 'POST /api/v1/orders/[id]/ship', requestId);
  }
}
