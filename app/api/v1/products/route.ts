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
  // Omitted or 0 → platform defaults below (D20 / api-contract E10).
  dispatchFeeKobo: z.number().int().nonnegative('dispatchFeeKobo must be >= 0').optional(),
  deliveryDays: z.number().int().min(0, 'deliveryDays must be >= 0').optional(),
  stockQuantity: z.number().int().nonnegative().default(1),
  description: z.string().trim().default(''),
  imageUrl: z
    .string()
    .trim()
    .optional()
    .transform((v) => (!v ? undefined : v))
    .pipe(z.string().url('imageUrl must be a valid URL').optional()),
});

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);

  try {
    const sellerId = request.nextUrl.searchParams.get('seller_id');

    if (sellerId) {
      // D23: public storefront catalog (no auth required).
      const products = await db.product.findMany({
        where: { sellerId },
        include: { seller: { select: { id: true, businessName: true } } },
        orderBy: { createdAt: 'desc' },
      });
      return ok(products);
    }

    // R7: no anonymous unscoped listing; authed sellers see only their own inventory.
    const claims = authenticate(request);
    if (!claims) return unauthorized();
    if (claims.role !== 'seller') return forbidden('Only sellers list inventory.');

    const products = await db.product.findMany({
      where: { sellerId: String(claims.sub) },
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
      data: {
        ...parsed.data,
        dispatchFeeKobo: parsed.data.dispatchFeeKobo || 250000,
        deliveryDays: parsed.data.deliveryDays || 3,
        sellerId: String(claims.sub),
      },
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
