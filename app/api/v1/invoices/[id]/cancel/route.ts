import { NextRequest } from 'next/server';
import db from '@/lib/db';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
import { authenticate, getRequestId } from '@/lib/auth';
import { shapeInvoice } from '@/lib/invoices';
import {
  ok,
  unauthorized,
  forbidden,
  notFound,
  handleError,
  tooManyRequestsResponse,
} from '@/lib/api-response';
import { InvalidTransitionError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: Params) {
  const requestId = getRequestId(request);

  try {
    const claims = authenticate(request);
    if (!claims) return unauthorized();
    if (claims.role !== 'seller') return forbidden('Only sellers can cancel invoices.');

    const { allowed, retryAfterMs } = await checkRateLimit(`act:invoice-cancel:${claims.sub}`, 20, 60_000);
    if (!allowed) return tooManyRequestsResponse(retryAfterMs);

    const { id } = await params;
    const invoice = await db.invoice.findUnique({ where: { id } });
    if (!invoice) return notFound('Invoice');
    if (invoice.sellerId !== String(claims.sub)) {
      return forbidden('You can only cancel your own invoices.');
    }
    if (invoice.status !== 'pending') {
      throw new InvalidTransitionError(invoice.status, 'cancelled');
    }

    const updated = await db.invoice.update({
      where: { id },
      data: { status: 'cancelled' },
    });

    logger.info('Invoice cancelled', { invoiceId: id, requestId });
    return ok(shapeInvoice(updated));
  } catch (err) {
    return handleError(err, 'POST /api/v1/invoices/:id/cancel', requestId);
  }
}
