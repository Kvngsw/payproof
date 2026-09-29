import { z } from 'zod';
import { NextRequest } from 'next/server';
import db from '@/lib/db';
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

const PatchSchema = z
  .object({
    name: z.string().trim().min(2).optional(),
    priceKobo: z.number().int().positive().optional(),
    price_kobo: z.number().int().positive().optional(),
    dispatchFeeKobo: z.number().int().nonnegative().optional(),
    dispatch_fee_kobo: z.number().int().nonnegative().optional(),
    deliveryDays: z.number().int().min(1).optional(),
    delivery_days: z.number().int().min(1).optional(),
    stockQuantity: z.number().int().nonnegative().optional(),
    stock_quantity: z.number().int().nonnegative().optional(),
    description: z.string().trim().optional(),
    imageUrl: z.string().trim().optional().transform((v) => (!v ? undefined : v)).pipe(z.string().url().optional()),
    image_url: z.string().trim().optional().transform((v) => (!v ? undefined : v)).pipe(z.string().url().optional()),
  })
  .transform((v) => ({
    ...(v.name !== undefined && { name: v.name }),
    ...(v.priceKobo ?? v.price_kobo !== undefined
      ? { priceKobo: (v.priceKobo ?? v.price_kobo) as number }
      : {}),
    ...(v.dispatchFeeKobo ?? v.dispatch_fee_kobo !== undefined
      ? { dispatchFeeKobo: (v.dispatchFeeKobo ?? v.dispatch_fee_kobo) as number }
      : {}),
    ...(v.deliveryDays ?? v.delivery_days !== undefined
      ? { deliveryDays: (v.deliveryDays ?? v.delivery_days) as number }
      : {}),
    ...(v.stockQuantity ?? v.stock_quantity !== undefined
      ? { stockQuantity: (v.stockQuantity ?? v.stock_quantity) as number }
      : {}),
    ...(v.description !== undefined && { description: v.description }),
    ...((v.imageUrl ?? v.image_url) !== undefined
      ? { imageUrl: (v.imageUrl ?? v.image_url) as string }
      : {}),
  }));

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: Params) {
  const requestId = getRequestId(request);

  try {
    const { id } = await params;
    const product = await db.product.findUnique({
      where: { id },
      include: { seller: { select: { id: true, businessName: true } } },
    });

    if (!product) return notFound('Product');
    return ok(product);
  } catch (err) {
    return handleError(err, 'GET /api/v1/products/[id]', requestId);
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const requestId = getRequestId(request);

  try {
    const claims = authenticate(request);
    if (!claims) return unauthorized();
    if (claims.role !== 'seller') return forbidden('Only sellers can update products.');

    const { id } = await params;
    const product = await db.product.findUnique({ where: { id } });
    if (!product || product.sellerId !== String(claims.sub)) {
      return notFound('Product');
    }

    const raw = await request.json().catch(() => null);
    const parsed = PatchSchema.safeParse(raw);

    if (!parsed.success) {
      return badRequest(parsed.error.issues[0].message);
    }

    const updated = await db.product.update({ where: { id }, data: parsed.data });
    return ok(updated);
  } catch (err) {
    return handleError(err, 'PATCH /api/v1/products/[id]', requestId);
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const requestId = getRequestId(request);

  try {
    const claims = authenticate(request);
    if (!claims) return unauthorized();
    if (claims.role !== 'seller') return forbidden('Only sellers can delete products.');

    const { allowed, retryAfterMs } = await checkRateLimit(`act:prod-delete:${claims.sub}`, 20, 60_000);
    if (!allowed) return tooManyRequestsResponse(retryAfterMs);

    const { id } = await params;
    const product = await db.product.findUnique({ where: { id } });
    if (!product) return notFound('Product');

    if (product.sellerId !== String(claims.sub)) {
      return forbidden('You can only delete your own products.');
    }

    const orderCount = await db.order.count({ where: { productId: id } });
    if (orderCount > 0) {
      return conflict(
        'This product has orders and cannot be deleted. Archive it instead.',
        'PRODUCT_HAS_ORDERS',
      );
    }

    await db.product.delete({ where: { id } });
    return ok({ ok: true });
  } catch (err) {
    return handleError(err, 'DELETE /api/v1/products/[id]', requestId);
  }
}
