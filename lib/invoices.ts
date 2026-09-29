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
