import crypto from 'crypto';
import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { logger } from '@/lib/logger';
import { checkRateLimit, clientIp } from '@/lib/rate-limit';
import { authenticate, getRequestId } from '@/lib/auth';
import { shapeInvoice } from '@/lib/invoices';
import {
  ok,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  handleError,
  tooManyRequestsResponse,
  conflict,
} from '@/lib/api-response';

export const dynamic = 'force-dynamic';

const CODE_RE = /^INV-[0-9A-F]{6}$/;

const CreateSchema = z.object({
  code: z.string().trim().regex(CODE_RE, 'code must match INV-XXXXXX').optional(),
  items: z
    .array(
      z.object({
        product_id: z.string().uuid('product_id must be a valid UUID'),
        quantity: z.number().int().min(1, 'quantity must be at least 1'),
      }),
    )
    .min(1, 'at least 1 item is required'),
  customer_name: z.string().trim().min(1, 'customer_name is required'),
  customer_contact: z.string().trim().min(1, 'customer_contact is required'),
  note: z.string().trim().max(500).default(''),
});

function newCode(): string {
  return `INV-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);

  try {
    const claims = authenticate(request);
    if (!claims) return unauthorized();
    if (claims.role !== 'seller') return forbidden('Only sellers list invoices.');

    const invoices = await db.invoice.findMany({
      where: { sellerId: String(claims.sub) },
      orderBy: { createdAt: 'desc' },
    });

    return ok(invoices.map(shapeInvoice));
  } catch (err) {
    return handleError(err, 'GET /api/v1/invoices', requestId);
  }
}

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  const ip = clientIp(request);

  const { allowed, retryAfterMs } = await checkRateLimit(`invoice:create:${ip}`, 20, 60_000);
  if (!allowed) {
    return tooManyRequestsResponse(retryAfterMs);
  }

  try {
    const claims = authenticate(request);
    if (!claims) return unauthorized();
    if (claims.role !== 'seller') return forbidden('Only sellers create invoices.');

    const raw = await request.json().catch(() => null);
    const parsed = CreateSchema.safeParse(raw);

    if (!parsed.success) {
      return badRequest(parsed.error.issues[0].message);
    }

    const { items, customer_name, customer_contact, note } = parsed.data;
    const sellerId = String(claims.sub);

    if (items.length !== 1 || items[0].quantity !== 1) {
      return badRequest('MVP invoices hold a single item at quantity 1.', 'VALIDATION');
    }

    const product = await db.product.findUnique({ where: { id: items[0].product_id } });
    if (!product) return notFound('Product');
    if (product.sellerId !== sellerId) {
      return forbidden('You can only invoice your own products.');
    }
    if (product.stockQuantity < 1) {
      return conflict(`Product ${product.name} is out of stock.`, 'OUT_OF_STOCK');
    }

    let id = parsed.data.code ?? newCode();
    for (let attempt = 0; attempt < 3; attempt++) {
      const exists = await db.invoice.findUnique({ where: { id } });
      if (!exists) break;
      if (parsed.data.code) {
        return conflict('Invoice code already exists.', 'DUPLICATE');
      }
      id = newCode();
    }

    const unitPriceKobo = product.priceKobo;
    const dispatchFeeKobo = product.dispatchFeeKobo;

    const invoice = await db.invoice.create({
      data: {
        id,
        sellerId,
        customerName: customer_name,
        customerContact: customer_contact,
        note,
        productId: product.id,
        productName: product.name,
        imageUrl: product.imageUrl,
        unitPriceKobo,
        dispatchFeeKobo,
        totalKobo: unitPriceKobo + dispatchFeeKobo,
      },
    });

    logger.info('Invoice created', { invoiceId: invoice.id, sellerId, requestId });

    const response = NextResponse.json(shapeInvoice(invoice), { status: 201 });
    return response;
  } catch (err) {
    return handleError(err, 'POST /api/v1/invoices', requestId);
  }
}
