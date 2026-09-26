/**
 * app/api/v1/orders/[id]/tracking/route.ts — Update tracking (E18).
 *
 * PATCH — seller (owner). Forward-only tracking statuses; setting `Delivered`
 * also moves the order `Shipped → Delivered`. Anything else → order untouched.
 */

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

// Forward-only ladder — index must strictly increase.
const LADDER = ['Picked Up', 'In Transit', 'Out for Delivery', 'Delivered'] as const;

const BodySchema = z.object({
  tracking_status: z.enum(LADDER),
  tracking_number: z.string().trim().min(3).optional(),
});

interface Params {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const requestId = getRequestId(request);

  try {
    const claims = authenticate(request);
    if (!claims) return unauthorized();
    if (claims.role !== 'seller') return forbidden('Only the seller can update tracking.');

    const { allowed, retryAfterMs } = await checkRateLimit(`act:tracking:${claims.sub}`, 30, 60_000);
    if (!allowed) return tooManyRequestsResponse(retryAfterMs);

    const { id } = await params;
    const order = await db.order.findUnique({ where: { id } });
    if (!order || order.sellerId !== String(claims.sub)) {
      return notFound('Order');
    }

    const raw = await request.json().catch(() => null);
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      return badRequest(parsed.error.issues[0].message);
    }

    const nextIdx = LADDER.indexOf(parsed.data.tracking_status);
    const curIdx = order.trackingStatus ? LADDER.indexOf(order.trackingStatus as (typeof LADDER)[number]) : -1;

    if (nextIdx <= curIdx) {
      return badRequest(
        `Tracking cannot move backwards (${order.trackingStatus} → ${parsed.data.tracking_status}).`,
      );
    }

    await db.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: order.id },
        data: {
          trackingStatus: parsed.data.tracking_status,
          trackingSource: 'manual',
          ...(parsed.data.tracking_number && { trackingNumber: parsed.data.tracking_number }),
        },
      });

      // Seller marking Delivered advances the order too (claim, D2).
      if (parsed.data.tracking_status === 'Delivered' && order.status === 'Shipped') {
        await transition(order.id, 'Delivered', 'seller', 'Tracking marked Delivered by seller', tx);
      }
    });

    logger.info('Tracking updated', {
      orderId: order.id,
      status: parsed.data.tracking_status,
      requestId,
    });

    return ok({ id: order.id, tracking_status: parsed.data.tracking_status });
  } catch (err) {
    return handleError(err, 'PATCH /api/v1/orders/[id]/tracking', requestId);
  }
}
