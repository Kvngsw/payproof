import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/mock/auth";
import { findOwnedOrder, notFound } from "@/lib/mock/order-actions";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = verifyToken(request.headers.get("authorization"));
  if (!user) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Token required" } },
      { status: 401 },
    );
  }

  const { id } = await params;
  const order = findOwnedOrder(id, user);
  if (!order) return notFound();

  let status = order.payout.status;
  if (order.status === "Disputed") status = "frozen";

  return NextResponse.json({
    status,
    product_kobo: order.amounts.product_kobo,
    dispatch_kobo: order.amounts.dispatch_fee_kobo,
    transfers: [],
  });
}
