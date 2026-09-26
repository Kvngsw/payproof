import crypto from 'crypto';
import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { logger } from '@/lib/logger';
import { checkRateLimit, clientIp } from '@/lib/rate-limit';
import { authenticate, getRequestId } from '@/lib/auth';
import { initializeTransaction } from '@/lib/monnify';
import {
  ok,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  handleError,
  tooManyRequestsResponse,
} from '@/lib/api-response';
import { OutOfStockError, RailError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

const CreateSchema = z.object({
  product_id: z.string().uuid('product_id must be a valid UUID'),
  delivery_address: z.string().trim().min(10, 'delivery_address must be at least 10 characters'),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[\d\s-]+$/, 'invalid phone number')
    .optional(),
});

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);

  try {
    const claims = authenticate(request);
    if (!claims) return unauthorized();

    const status = request.nextUrl.searchParams.get('status');
    const sub = String(claims.sub);

    const orders = await db.order.findMany({
      where: {
        ...(claims.role === 'buyer' ? { buyerId: sub } : { sellerId: sub }),
        ...(status ? { status } : {}),
      },
      select: {
        id: true,
        status: true,
        productPriceKobo: true,
        dispatchFeeKobo: true,
        totalKobo: true,
        createdAt: true,
        updatedAt: true,
        product: { select: { id: true, name: true, imageUrl: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return ok(orders);
  } catch (err) {
    return handleError(err, 'GET /api/v1/orders', requestId);
  }
}

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  const ip = clientIp(request);

  const { allowed, retryAfterMs } = await checkRateLimit(`order:create:${ip}`, 20, 60_000);
  if (!allowed) {
    return tooManyRequestsResponse(retryAfterMs);
  }

  try {
    const claims = authenticate(request);
    if (!claims) return unauthorized();
    if (claims.role !== 'buyer') return forbidden('Only buyers can create orders.');

    const raw = await request.json().catch(() => null);
    const parsed = CreateSchema.safeParse(raw);

    if (!parsed.success) {
      return badRequest(parsed.error.issues[0].message);
    }

    const { product_id, delivery_address, phone } = parsed.data;
    const buyerId = String(claims.sub);

    const product = await db.product.findUnique({
      where: { id: product_id },
      include: { seller: { select: { id: true } } },
    });

    if (!product) return notFound('Product');
    if (product.stockQuantity <= 0) throw new OutOfStockError(product_id); // check here, decrement only on Paid (D10)

    const buyer = await db.buyer.findUnique({ where: { id: buyerId } });
    if (!buyer) return unauthorized('Session expired. Please log in again.');

    const totalKobo = product.priceKobo + product.dispatchFeeKobo;
    const ref = `pp_ord_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`;

    const order = await db.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          sellerId: product.sellerId,
          buyerId,
          productId: product.id,
          productPriceKobo: product.priceKobo,
          dispatchFeeKobo: product.dispatchFeeKobo,
          totalKobo,
          deliveryDays: product.deliveryDays,
          status: 'PendingPayment',
          deliveryAddress: delivery_address,
          buyerPhone: phone ?? null,
          trackingSource: 'manual',
        },
      });

      await tx.payment.create({
        data: {
          orderId: created.id,
          provider: 'monnify',
          reference: ref,
          status: 'pending',
          verificationMode: 'live',
          amountKobo: totalKobo,
        },
      });

      await tx.orderEvent.create({
        data: {
          orderId: created.id,
          fromStatus: 'PendingPayment',
          toStatus: 'PendingPayment',
          actor: 'buyer',
          note: 'Order created, awaiting payment',
        },
      });

      return created;
    });

    logger.info('Order created', {
      orderId: order.id,
      buyerId,
      sellerId: product.sellerId,
      totalKobo,
      requestId,
    });

    let checkout: { reference: string; checkoutUrl: string };
    try {
      checkout = await initializeTransaction({
        ref,
        totalKobo,
        productName: product.name,
        buyerEmail: buyer.email,
        redirectUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/orders/${order.id}/return`,
      });

      await db.payment.update({
        where: { reference: ref },
        data: { providerRef: checkout.reference },
      });
    } catch (railErr) {
      logger.error('Order init-transaction failed — compensating', {
        orderId: order.id,
        err: railErr,
        requestId,
      });
      await db.payment.deleteMany({ where: { orderId: order.id } }); // rail failed: no orphan PendingPayment rows
      await db.orderEvent.deleteMany({ where: { orderId: order.id } });
      await db.order.delete({ where: { id: order.id } }).catch(() => {});
      throw new RailError('Could not initialise payment. Please try again.');
    }

    return NextResponse.json(
      {
        order: {
          id: order.id,
          status: order.status,
          amounts: {
            product_kobo: product.priceKobo,
            dispatch_fee_kobo: product.dispatchFeeKobo,
            total_kobo: totalKobo,
          },
        },
        payment: {
          reference: ref,
          provider: 'monnify',
          checkout_url: checkout.checkoutUrl,
        },
      },
      { status: 201 },
    );
  } catch (err) {
    return handleError(err, 'POST /api/v1/orders', requestId);
  }
}
