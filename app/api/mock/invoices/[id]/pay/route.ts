import { NextResponse } from "next/server";
import { requireRole } from "@/lib/mock/order-actions";
import { db, generateId } from "@/lib/mock/store";
import {
  isReadOnly,
  readOnlyResponse,
  READ_ONLY_ACTION_MESSAGE,
} from "@/lib/mock/read-only";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (isReadOnly()) return readOnlyResponse(READ_ONLY_ACTION_MESSAGE);
  const auth = requireRole(request, "buyer");
  if ("error" in auth) return auth.error;
  const user = auth.user;

  const { id } = await params;
  const invoice = db.invoices.findByCode(id);
  if (!invoice) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Invoice not found" } },
      { status: 404 }
    );
  }

  if (invoice.status !== "pending") {
    return NextResponse.json(
      {
        error: {
          code: "INVOICE_NOT_PAYABLE",
          message:
            invoice.status === "paid"
              ? "This invoice has already been paid"
              : "This invoice was cancelled",
        },
      },
      { status: 409 },
    );
  }

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {}

  const deliveryAddress = String(body.delivery_address ?? "").trim();
  if (deliveryAddress.length < 10) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION",
          message: "delivery address must be at least 10 characters",
        },
      },
      { status: 400 },
    );
  }

  const phone = String(body.phone ?? "").trim();
  if (!phone) {
    return NextResponse.json(
      { error: { code: "VALIDATION", message: "phone number is required" } },
      { status: 400 },
    );
  }

  const dispatchFeeKobo =
    invoice.dispatch_fee_kobo ??
    Math.max(
      0,
      invoice.total_kobo - invoice.product_kobo,
    );

  const items = invoice.items ?? [];
  if (items.length === 0) {
    return NextResponse.json(
      { error: { code: "VALIDATION", message: "invoice has no items" } },
      { status: 400 },
    );
  }

  for (const item of items) {
    const product = db.products.findById(item.product_id);
    if (!product) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: `${item.name} no longer exists` } },
        { status: 404 },
      );
    }
    if (product.stock_quantity < item.quantity) {
      return NextResponse.json(
        {
          error: {
            code: "OUT_OF_STOCK",
            message: `${item.name}: only ${product.stock_quantity} in stock`,
          },
        },
        { status: 409 },
      );
    }
  }

  const now = new Date().toISOString();
  const orderId = generateId();

  const order = {
    id: orderId,
    seller_id: invoice.seller_id,
    buyer_email: user.email,
    status: "Awaiting Shipment",
    product: {
      id: items[0].product_id,
      name:
        items.length === 1
          ? items[0].name
          : `${items[0].name} +${items.length - 1} more`,
      image_url: items[0].image_url ?? "",
    },
    amounts: {
      product_kobo: invoice.product_kobo,
      dispatch_fee_kobo: dispatchFeeKobo,
      total_kobo: invoice.product_kobo + dispatchFeeKobo,
    },
    delivery_days: 3,
    delivery_address: deliveryAddress,
    phone,
    tracking: {
      status: null,
      number: null,
      source: "manual",
      label: "Manually updated by seller",
    },
    payment: {
      reference: `pp_inv_${invoice.id}`,
      provider: "manual",
      verification_mode: "simulated",
      paid_at: now,
    },
    payout: { status: "pending" },
    fraud_flag: {
      triggered: false,
      state: "clear",
      label: "Rule-based",
    },
    events: [
      {
        from: "Pending Payment",
        to: "Paid",
        actor: "system",
        at: now,
        note: "Payment verified",
      },
      {
        from: "Paid",
        to: "Awaiting Shipment",
        actor: "system",
        at: now,
        note: "Invoice paid",
      },
    ],
    created_at: now,
    updated_at: now,
  };

  for (const item of items) {
    db.products.updateById(item.product_id, (product) => {
      product.stock_quantity = Math.max(
        0,
        product.stock_quantity - item.quantity,
      );
    });
  }

  db.orders.insertMany([order]);
  db.invoices.updateById(invoice.id, (row) => {
    row.status = "paid";
    row.paid_at = now;
    row.order_id = orderId;
  });

  return NextResponse.json({ order_id: orderId }, { status: 201 });
}
