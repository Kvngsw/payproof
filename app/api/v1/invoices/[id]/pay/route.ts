import { z } from 'zod';
import { NextRequest } from 'next/server';
import db from '@/lib/db';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
import { authenticate, getRequestId } from '@/lib/auth';
import { initializeTransaction } from '@/lib/monnify';
import { shapeInvoice, buyerMatchesContact } from '@/lib/invoices';
import {
  ok,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  handleError,
  tooManyRequestsResponse,
} from '@/lib/api-response';
import { InvalidTransitionError, OutOfStockError, RailError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

const BodySchema = z.object({
  delivery_address: z.string().trim().min(10, 'delivery_address must be at least 10 characters'),
  phone: z
    .string()
    .trim()
    .min(7, 'phone is required')
    .regex(/^\+?[\d\s-]+$/, 'invalid phone number'),
});

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: Params) {
  const requestId = getRequestId(request);

  try {
    const claims = authenticate(request);
    if (!claims) return unauthorized();
    if (claims.role !== 'buyer') return forbidden('Only buyers can pay invoices.');

    const { allowed, retryAfterMs } = await checkRateLimit(`act:invoice-pay:${claims.sub}`, 10, 15 * 60_000);
    if (!allowed) return tooManyRequestsResponse(retryAfterMs);

    const { id } = await params;
    const invoice = await db.invoice.findUnique({ where: { id } });
    if (!invoice) return notFound('Invoice');

    if (invoice.status !== 'pending') {
      throw new InvalidTransitionError(invoice.status, 'paid');
    }

    const raw = await request.json().catch(() => null);
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      return badRequest(parsed.error.issues[0].message);
    }

    const buyerId = String(claims.sub);
    const buyer = await db.buyer.findUnique({ where: { id: buyerId } });
    if (!buyer) return unauthorized('Session expired. Please log in again.');
    if (!buyerMatchesContact(buyer, invoice.customerContact)) {
      return forbidden('This invoice does not belong to you.');
    }

    const product = await db.product.findUnique({ where: { id: invoice.productId } });
    if (!product || product.stockQuantity < 1) {
      throw new OutOfStockError(invoice.productId);
    }

    const ref = `pp_inv_${invoice.id.slice(0, 8)}_${Date.now().toString(36)}`;

    const order = await db.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          sellerId: invoice.sellerId,
          buyerId,
          productId: invoice.productId,
          productPriceKobo: invoice.unitPriceKobo,
          dispatchFeeKobo: invoice.dispatchFeeKobo,
          totalKobo: invoice.totalKobo,
          deliveryDays: product.deliveryDays,
          status: 'PendingPayment',
          deliveryAddress: parsed.data.delivery_address,
          buyerPhone: parsed.data.phone,
          trackingSource: 'manual',
        },
      });

      await tx.payment.create({
        data: {
          orderId: created.id,
          invoiceId: invoice.id,
          provider: 'monnify',
          reference: ref,
          status: 'pending',
          verificationMode: 'live',
          amountKobo: invoice.totalKobo,
        },
      });

      await tx.orderEvent.create({
        data: {
          orderId: created.id,
          fromStatus: 'PendingPayment',
          toStatus: 'PendingPayment',
          actor: 'buyer',
          note: `Born from invoice ${invoice.id}`,
        },
      });

      await tx.invoice.update({
        where: { id: invoice.id },
        data: { status: 'processing', orderId: created.id },
      });

      return created;
    });

    logger.info('Invoice pay order created', {
      invoiceId: invoice.id,
      orderId: order.id,
      buyerId,
      requestId,
    });

    let checkout: { reference: string; checkoutUrl: string };
    try {
      checkout = await initializeTransaction({
        ref,
        totalKobo: invoice.totalKobo,
        productName: invoice.productName,
        buyerEmail: buyer.email,
        redirectUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin}/dashboard/orders/${order.id}`,
      });

      await db.payment.update({
        where: { reference: ref },
        data: { providerRef: checkout.reference },
      });
    } catch (railErr) {
      logger.error('Invoice pay init failed — compensating', {
        invoiceId: invoice.id,
        orderId: order.id,
        err: railErr,
        requestId,
      });
      await db.payment.deleteMany({ where: { orderId: order.id } });
      await db.orderEvent.deleteMany({ where: { orderId: order.id } });
      await db.order.delete({ where: { id: order.id } }).catch(() => {});
      await db.invoice.update({
        where: { id: invoice.id },
        data: { status: 'pending', orderId: null },
      });
      throw new RailError('Could not initialise payment. Please try again.');
    }

    const updated = await db.invoice.findUniqueOrThrow({ where: { id: invoice.id } });

    return ok(
      {
        invoice: shapeInvoice(updated),
        order: { id: order.id, status: order.status },
        payment: { checkout_url: checkout.checkoutUrl, reference: ref },
      },
      201,
    );
  } catch (err) {
    return handleError(err, 'POST /api/v1/invoices/:id/pay', requestId);
  }
}
