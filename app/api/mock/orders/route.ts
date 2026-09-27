import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/mock/auth";
import { db, readCollection } from "@/lib/mock/store";
import {
  ensureDemoSellers,
  ensureOrdersForSeller,
  ensureDemoData,
} from "@/lib/mock/seed";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const user = verifyToken(authHeader);

  if (!user) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Token required" } },
      { status: 401 }
    );
  }

  if (user.role === "buyer") {
    ensureDemoData();

    const status = new URL(request.url).searchParams.get("status");
    let orders = readCollection("orders").filter(
      (o) => !o.buyer_email || o.buyer_email === user.email,
    );
    if (status) orders = orders.filter((o) => o.status === status);

    const withSeller = orders.map((order) => ({
      ...order,
      seller: {
        id: order.seller_id,
        business_name: db.sellers.findById(order.seller_id)?.business_name ?? "",
      },
    }));

    withSeller.sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));

    return NextResponse.json(withSeller);
  }

  ensureDemoSellers();
  const seller = db.sellers.findById(user.sub);
  if (!seller) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Seller not found" } },
      { status: 404 }
    );
  }

  ensureOrdersForSeller(seller);

  const status = new URL(request.url).searchParams.get("status");
  let orders = db.orders.findBySeller(seller.id);
  if (status) orders = orders.filter((o) => o.status === status);

  const withSeller = orders.map((order) => ({
    ...order,
    seller: {
      id: seller.id,
      business_name: seller.business_name,
    },
  }));

  withSeller.sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));

  return NextResponse.json(withSeller);
}
