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
  reason: z.string().trim().min(10, 'reason must be at least 10 characters').max(500, 'reason must be ≤ 500 characters'),
});

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: Params) {
  const requestId = getRequestId(request);

  try {
    const claims = authenticate(request);
    if (!claims) return unauthorized();
    if (claims.role !== 'buyer') return forbidden('Only the buyer can report an issue.');

    const { allowed, retryAfterMs } = await checkRateLimit(`act:dispute:${claims.sub}`, 20, 60_000);
    if (!allowed) return tooManyRequestsResponse(retryAfterMs);

    const { id } = await params;
    const order = await db.order.findUnique({ where: { id } });
    if (!order || order.buyerId !== String(claims.sub)) {
      return notFound('Order');
    }

    const raw = await request.json().catch(() => null);
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      return badRequest(parsed.error.issues[0].message);
    }

    await transition(order.id, 'Disputed', 'buyer', parsed.data.reason);

    logger.warn('Order disputed — payout frozen', {
      orderId: order.id,
      reason: parsed.data.reason,
      requestId,
    });

    return ok({ id: order.id, status: 'Disputed' });
  } catch (err) {
    return handleError(err, 'POST /api/v1/orders/[id]/report-issue', requestId);
  }
}
