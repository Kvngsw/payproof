import { z } from 'zod';
import { NextRequest } from 'next/server';
import db from '@/lib/db';
import { logger } from '@/lib/logger';
import { authenticate, getRequestId } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limit';
import {
  ok,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  conflict,
  handleError,
  tooManyRequestsResponse,
} from '@/lib/api-response';

export const dynamic = 'force-dynamic';

const BodySchema = z.object({
  stars: z.number().int().min(1).max(5),
});

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: Params) {
  const requestId = getRequestId(request);

  try {
    const claims = authenticate(request);
    if (!claims) return unauthorized();
    if (claims.role !== 'buyer') return forbidden('Only the buyer can rate this order.');

    const { allowed, retryAfterMs } = await checkRateLimit(`act:rate:${claims.sub}`, 20, 60_000);
    if (!allowed) return tooManyRequestsResponse(retryAfterMs);

    const { id } = await params;
    const order = await db.order.findUnique({
      where: { id },
      include: { rating: { select: { id: true } } },
    });
    if (!order || order.buyerId !== String(claims.sub)) {
      return notFound('Order');
    }

    const raw = await request.json().catch(() => null);
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      return badRequest('Stars must be an integer between 1 and 5.');
    }

    if (order.rating) {
      return conflict('This order has already been rated.', 'DUPLICATE');
    }
    if (order.status !== 'Completed') {
      return conflict(
        `Cannot do that to an order in status "${order.status}".`,
        'INVALID_TRANSITION',
      );
    }

    try {
      await db.rating.create({
        data: {
          stars: parsed.data.stars,
          orderId: order.id,
          sellerId: order.sellerId,
          buyerId: order.buyerId,
        },
      });
    } catch (err) {
      if ((err as { code?: string }).code === 'P2002') {
        return conflict('This order has already been rated.', 'DUPLICATE');
      }
      throw err;
    }

    logger.info('Order rated by buyer', { orderId: order.id, requestId });

    return ok({ id: order.id, status: order.status, rating: parsed.data.stars }, 201);
  } catch (err) {
    return handleError(err, 'POST /api/v1/orders/[id]/rating', requestId);
  }
}
