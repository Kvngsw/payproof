/**
 * app/api/v1/products/route.ts — Product list + create (E08, E10).
 *
 * GET  /api/v1/products?seller_id=  — public, `[Product]`
 * POST /api/v1/products              — seller, `201 Product`
 */

import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { logger } from '@/lib/logger';
import { checkRateLimit, clientIp } from '@/lib/rate-limit';
import { authenticate, getRequestId } from '@/lib/auth';
import {
  ok,
  badRequest,
  unauthorized,
  forbidden,
  handleError,
  tooManyRequestsResponse,
} from '@/lib/api-response';

export const dynamic = 'force-dynamic';

const CreateSchema = z.object({
  name: z.string().trim().min(2, 'name must be at least 2 characters'),
  priceKobo: z.number().int('priceKobo must be an integer (kobo, not naira)').positive('priceKobo must be positive'),
  dispatchFeeKobo: z.number().int().nonnegative('dispatchFeeKobo must be >= 0'),
  deliveryDays: z.number().int().min(1, 'deliveryDays must be at least 1'),
  stockQuantity: z.number().int().nonnegative().default(1),
  description: z.string().trim().min(10, 'description must be at least 10 characters'),
  imageUrl: z.string().url('imageUrl must be a valid URL').optional(),
});

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);

  try {
    const sellerId = request.nextUrl.searchParams.get('seller_id');

    const products = await db.product.findMany({
      where: sellerId ? { sellerId } : undefined,
      include: { seller: { select: { id: true, businessName: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return ok(products);
  } catch (err) {
    return handleError(err, 'GET /api/v1/products', requestId);
  }
}

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  const ip = clientIp(request);

  const { allowed, retryAfterMs } = await checkRateLimit(`prod:create:${ip}`, 30, 60_000);
  if (!allowed) {
    return tooManyRequestsResponse(retryAfterMs);
  }

  try {
    const claims = authenticate(request);
    if (!claims) return unauthorized();
    if (claims.role !== 'seller') return forbidden('Only sellers can create products.');

    const raw = await request.json().catch(() => null);
    const parsed = CreateSchema.safeParse(raw);

    if (!parsed.success) {
      const details = Object.fromEntries(
        parsed.error.issues.map((i) => [i.path.join('.'), i.message]),
      );
      return badRequest(parsed.error.issues[0].message, 'VALIDATION', details);
    }

    const product = await db.product.create({
      data: { ...parsed.data, sellerId: String(claims.sub) },
    });

    logger.info('Product created', {
      productId: product.id,
      sellerId: String(claims.sub),
      requestId,
    });

    const response = NextResponse.json(product, { status: 201 });
    return response;
  } catch (err) {
    return handleError(err, 'POST /api/v1/products', requestId);
  }
}
