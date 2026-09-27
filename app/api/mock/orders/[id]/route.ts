import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/mock/auth";
import { db } from "@/lib/mock/store";
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

  return NextResponse.json({
    ...order,
    seller: seller
      ? { id: seller.id, business_name: seller.business_name }
      : { id: order.seller_id, business_name: "" },
  });
}
