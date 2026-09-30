import { NextRequest } from 'next/server';
import db from '@/lib/db';
import { authenticate, getRequestId } from '@/lib/auth';
import { shapeInvoice, buyerMatchesContact } from '@/lib/invoices';
import { ok, unauthorized, forbidden, notFound, handleError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: Params) {
  const requestId = getRequestId(request);

  try {
    const claims = authenticate(request);
    if (!claims) return unauthorized();

    const { id } = await params;
    const sub = String(claims.sub);

    const invoice = await db.invoice.findUnique({
      where: { id },
      include: { seller: { select: { id: true, businessName: true } } },
    });

    if (!invoice) return notFound('Invoice');

    if (claims.role === 'seller') {
      if (invoice.sellerId !== sub) return forbidden('You can only view your own invoices.');
    } else {
      const buyer = await db.buyer.findUnique({ where: { id: sub } });
      if (!buyer || !buyerMatchesContact(buyer, invoice.customerContact)) {
        return forbidden('This invoice was not issued to you.');
      }
    }

    return ok({
      ...shapeInvoice(invoice),
      seller: { business_name: invoice.seller.businessName },
    });
  } catch (err) {
    return handleError(err, 'GET /api/v1/invoices/[id]', requestId);
  }
}
