import { NextResponse } from "next/server";
import {
  requireRole,
  findOwnedOrder,
  transition,
  persist,
  notFound,
} from "@/lib/mock/order-actions";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireRole(request, "buyer");
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const order = findOwnedOrder(id, auth.user);
  if (!order) return notFound();

  if (order.status === "Shipped") {
    const first = transition(order, "Delivered", "buyer", ["Shipped"], "Buyer confirmed from Shipped");
    if (first instanceof NextResponse) return first;
  }

  const result = transition(order, "Completed", "buyer", ["Delivered"], "Buyer confirmed delivery");
  if (result instanceof NextResponse) return result;

  order.payout.status = "paid";
  persist(order);

  return NextResponse.json({
    id: order.id,
    status: order.status,
    payout: { status: order.payout.status },
  });
}
