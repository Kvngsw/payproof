import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/mock/auth";
import { db } from "@/lib/mock/store";
import { ensureDemoSellers, ensureOrdersForSeller } from "@/lib/mock/seed";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const user = verifyToken(authHeader);

  if (!user || user.role !== "seller") {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Seller token required" } },
      { status: 401 }
    );
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
