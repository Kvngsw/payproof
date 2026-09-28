import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/mock/auth";
import { db, generateId } from "@/lib/mock/store";
import {
  isReadOnly,
  readOnlyResponse,
  READ_ONLY_ACTION_MESSAGE,
} from "@/lib/mock/read-only";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const sellerId = new URL(request.url).searchParams.get("seller_id");

  // Public storefront path: ?seller_id= returns that seller's products, no auth.
  if (sellerId) {
    const owner = db.sellers.findById(sellerId);
    if (!owner) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Seller not found." } },
        { status: 404 },
      );
    }
    const publicProducts = db.products
      .findBySeller(owner.id)
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    return NextResponse.json(publicProducts);
  }

  const authHeader = request.headers.get("authorization");
  const user = verifyToken(authHeader);

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

  const products = db.products
    .findBySeller(seller.id)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  return NextResponse.json(products);
}

export async function POST(request: Request) {
  if (isReadOnly()) return readOnlyResponse(READ_ONLY_ACTION_MESSAGE);
  const authHeader = request.headers.get("authorization");
  const user = verifyToken(authHeader);

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

  const name = String(body.name ?? "").trim();
  const priceKobo = Number(body.price_kobo);
  if (!name || !Number.isFinite(priceKobo) || priceKobo <= 0) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION",
          message: "name and a positive price are required",
        },
      },
      { status: 400 }
    );
  }

  const product = {
    id: generateId(),
    seller_id: seller.id,
    name,
    price_kobo: Math.round(priceKobo),
    dispatch_fee_kobo: Math.max(0, Math.round(Number(body.dispatch_fee_kobo) || 0)),
    description: String(body.description ?? "").trim(),
    image_url: String(body.image_url ?? "").trim(),
    stock_quantity: Math.max(0, Math.round(Number(body.stock_quantity) || 0)),
    created_at: new Date().toISOString(),
  };

  db.products.insert(product);
  return NextResponse.json(product, { status: 201 });
}
