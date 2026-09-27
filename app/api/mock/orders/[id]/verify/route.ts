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

  const now = new Date().toISOString();

  if (order.status === "Paid") {
    const resumed = transition(
      order,
      "Awaiting Shipment",
      "system",
      ["Paid"],
      "Payment verified",
    );
    if (resumed instanceof NextResponse) return resumed;
    persist(order);
    return NextResponse.json({
      id: order.id,
      status: order.status,
      verification_mode: order.payment.verification_mode,
    });
  }

  if (order.status !== "Pending Payment") {
    return NextResponse.json({
      id: order.id,
      status: order.status,
      verification_mode: order.payment.verification_mode,
    });
  }

  order.payment.verification_mode = "simulated";
  order.payment.paid_at = now;
  order.payout.status = "pending";

  const result = transition(order, "Paid", "system", ["Pending Payment"], "Payment verified");
  if (result instanceof NextResponse) return result;

  persist(order);

  return NextResponse.json({
    id: order.id,
    status: order.status,
    verification_mode: order.payment.verification_mode,
  });
}
