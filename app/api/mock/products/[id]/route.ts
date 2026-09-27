import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/mock/auth";
import { db } from "@/lib/mock/store";
import {
  isReadOnly,
  readOnlyResponse,
  READ_ONLY_ACTION_MESSAGE,
} from "@/lib/mock/read-only";

export const dynamic = "force-dynamic";

function requireSeller(request: Request) {
  const user = verifyToken(request.headers.get("authorization"));
  if (!user || user.role !== "seller") return null;
  return db.sellers.findById(user.sub);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (isReadOnly()) return readOnlyResponse(READ_ONLY_ACTION_MESSAGE);
  const seller = requireSeller(request);
  if (!seller) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Seller token required" } },
      { status: 401 }
    );
  }

  const { id } = await params;
  const product = db.products
    .findBySeller(seller.id)
    .find((p) => p.id === id);
  if (!product) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Product not found" } },
      { status: 404 }
    );
  }

  let body: any = {};
  try {
    body = await request.json();
  } catch {}

  const patch: any = {};
  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) {
      return NextResponse.json(
        { error: { code: "VALIDATION", message: "name cannot be empty" } },
        { status: 400 }
      );
    }
    patch.name = name;
  }
  if (body.price_kobo !== undefined) {
    const price = Number(body.price_kobo);
    if (!Number.isFinite(price) || price <= 0) {
      return NextResponse.json(
        { error: { code: "VALIDATION", message: "price must be positive" } },
        { status: 400 }
      );
    }
    patch.price_kobo = Math.round(price);
  }
  if (body.description !== undefined)
    patch.description = String(body.description).trim();
  if (body.image_url !== undefined)
    patch.image_url = String(body.image_url).trim();
  if (body.stock_quantity !== undefined)
    patch.stock_quantity = Math.max(
      0,
      Math.round(Number(body.stock_quantity) || 0),
    );

  const updated = db.products.updateById(product.id, (p) =>
    Object.assign(p, patch),
  );
  return NextResponse.json(updated);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (isReadOnly()) return readOnlyResponse(READ_ONLY_ACTION_MESSAGE);
  const seller = requireSeller(request);
  if (!seller) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Seller token required" } },
      { status: 401 }
    );
  }

  const { id } = await params;
  const product = db.products
    .findBySeller(seller.id)
    .find((p) => p.id === id);
  if (!product) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Product not found" } },
      { status: 404 }
    );
  }

  db.products.removeById(product.id);
  return NextResponse.json({ ok: true });
}
