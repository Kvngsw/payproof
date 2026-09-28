import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/mock/auth";
import { db, readCollection } from "@/lib/mock/store";
import { findOrder, ownsOrder } from "@/lib/mock/order-actions";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authHeader = request.headers.get("authorization");
  const user = verifyToken(authHeader);

  if (!user) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Token required" } },
      { status: 401 }
    );
  }

  const { id } = await params;

  const order = findOrder(id);
  if (!order || !ownsOrder(order, user)) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Order not found" } },
      { status: 404 }
    );
  }

  const seller = db.sellers.findById(order.seller_id);

  const buyerEmail = order.buyer_email ?? null;
  const buyerRow = buyerEmail ? db.buyers.findByEmail(buyerEmail) : null;
  const buyerOrderCount = buyerEmail
    ? (readCollection("orders") as { buyer_email?: string }[]).filter(
        (o) => o.buyer_email === buyerEmail,
      ).length
    : 0;

  return NextResponse.json({
    ...order,
    seller: seller
      ? { id: seller.id, business_name: seller.business_name }
      : { id: order.seller_id, business_name: "" },
    buyer: buyerEmail
      ? {
          name: buyerRow?.name ?? buyerEmail,
          email: buyerEmail,
          created_at: buyerRow?.created_at ?? null,
          order_count: buyerOrderCount,
        }
      : null,
  });
}
