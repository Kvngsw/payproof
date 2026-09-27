import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/mock/auth";
import { db, generateInvoiceCode } from "@/lib/mock/store";
import { ensureInvoicesForSeller } from "@/lib/mock/seed";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = verifyToken(request.headers.get("authorization"));
  if (!user || user.role !== "seller") {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Seller token required" } },
      { status: 401 }
    );
  }

  const seller = db.sellers.findById(user.sub);
  if (!seller) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Seller not found" } },
      { status: 404 }
    );
  }

  ensureInvoicesForSeller(seller);
  const invoices = db.invoices
    .findBySeller(seller.id)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  return NextResponse.json(invoices);
}

export async function POST(request: Request) {
  const user = verifyToken(request.headers.get("authorization"));
  if (!user || user.role !== "seller") {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Seller token required" } },
      { status: 401 }
    );
  }

  const seller = db.sellers.findById(user.sub);
  if (!seller) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Seller not found" } },
      { status: 404 }
    );
  }

  let body: any = {};
  try {
    body = await request.json();
  } catch {}

  const customerName = String(body.customer_name ?? "").trim();
  if (!customerName) {
    return NextResponse.json(
      { error: { code: "VALIDATION", message: "customer name is required" } },
      { status: 400 }
    );
  }

  const rawItems = Array.isArray(body.items) ? body.items : [];
  if (rawItems.length === 0) {
    return NextResponse.json(
      { error: { code: "VALIDATION", message: "at least one item is required" } },
      { status: 400 }
    );
  }

  const sellerProducts = db.products.findBySeller(seller.id);
  const items: any[] = [];
  const seen = new Set<string>();
  let dispatchKobo = 0;

  for (const raw of rawItems) {
    const productId = String(raw?.product_id ?? "");
    const quantity = Math.round(Number(raw?.quantity));
    const product = sellerProducts.find((p) => p.id === productId);

    if (!product) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Product not found" } },
        { status: 404 }
      );
    }
    if (!Number.isFinite(quantity) || quantity < 1) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION",
            message: `${product.name}: quantity must be at least 1`,
          },
        },
        { status: 400 }
      );
    }
    if (seen.has(product.id)) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION",
            message: `${product.name}: listed twice`,
          },
        },
        { status: 400 }
      );
    }
    if (quantity > product.stock_quantity) {
      return NextResponse.json(
        {
          error: {
            code: "OUT_OF_STOCK",
            message: `${product.name}: only ${product.stock_quantity} in stock`,
          },
        },
        { status: 409 }
      );
    }
    seen.add(product.id);
    dispatchKobo = Math.max(
      dispatchKobo,
      Number(product.dispatch_fee_kobo) || 0,
    );
    items.push({
      product_id: product.id,
      name: product.name,
      image_url: product.image_url,
      quantity,
      unit_price_kobo: product.price_kobo,
    });
  }

  const subtotalKobo = items.reduce(
    (sum, item) => sum + item.quantity * item.unit_price_kobo,
    0,
  );

  let code = String(body.code ?? "").trim().toUpperCase();
  const validCode = /^INV-[0-9A-F]{6}$/.test(code);
  if (validCode && db.invoices.findByCode(code)) code = "";
  if (!validCode) {
    do {
      code = generateInvoiceCode();
    } while (db.invoices.findByCode(code));
  }

  const invoice = {
    id: code,
    seller_id: seller.id,
    items,
    product_kobo: subtotalKobo,
    dispatch_fee_kobo: dispatchKobo,
    total_kobo: subtotalKobo + dispatchKobo,
    customer: {
      name: customerName,
      contact: String(body.customer_contact ?? "").trim(),
    },
    note: String(body.note ?? "").trim(),
    status: "pending",
    order_id: null,
    created_at: new Date().toISOString(),
    paid_at: null,
  };

  db.invoices.insert(invoice);
  return NextResponse.json(invoice, { status: 201 });
}
