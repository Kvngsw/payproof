export interface InvoiceRow {
  id: string;
  sellerId: string;
  status: string;
  customerName: string;
  customerContact: string;
  note: string;
  productId: string;
  productName: string;
  imageUrl: string | null;
  unitPriceKobo: number;
  dispatchFeeKobo: number;
  totalKobo: number;
  orderId: string | null;
  createdAt: Date;
  paidAt: Date | null;
}

export function shapeInvoice(i: InvoiceRow) {
  return {
    id: i.id,
    seller_id: i.sellerId,
    items: [
      {
        product_id: i.productId,
        name: i.productName,
        image_url: i.imageUrl ?? '',
        quantity: 1,
        unit_price_kobo: i.unitPriceKobo,
      },
    ],
    product_kobo: i.unitPriceKobo,
    dispatch_fee_kobo: i.dispatchFeeKobo,
    total_kobo: i.totalKobo,
    customer: { name: i.customerName, contact: i.customerContact },
    note: i.note,
    status: i.status,
    order_id: i.orderId,
    created_at: i.createdAt,
    paid_at: i.paidAt,
  };
}

/** Digits-only phone form, for comparing contacts across formats. */
function phoneDigits(value: string): string {
  return value.replace(/\D/g, '');
}

/**
 * Does this authenticated buyer own an invoice addressed to `contact`?
 * Contact is "email or phone" (the FE label), so match either: emails
 * case-insensitively, phones by last-10 digits (normalizes +234 vs 0 prefixes).
 */
export function buyerMatchesContact(
  buyer: { email: string; phone?: string | null },
  contact: string,
): boolean {
  const target = contact.trim().toLowerCase();
  if (!target) return false;

  if (buyer.email.trim().toLowerCase() === target) return true;

  const contactDigits = phoneDigits(target);
  if (contactDigits.length >= 7) {
    const buyerDigits = phoneDigits(buyer.phone ?? '');
    const last10 = (v: string) => (v.length >= 10 ? v.slice(-10) : v);
    if (buyerDigits.length >= 7 && last10(buyerDigits) === last10(contactDigits)) {
      return true;
    }
  }

  return false;
}
