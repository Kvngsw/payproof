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

  const body = await request.json().catch(() => null);
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
  if (reason.length < 10 || reason.length > 500) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION",
          message: "reason must be between 10 and 500 characters",
        },
      },
      { status: 400 },
    );
  }

  const result = transition(
    order,
    "Disputed",
    "buyer",
    ["Shipped", "Delivered"],
    reason,
  );
  if (result instanceof NextResponse) return result;

  order.payout.status = "frozen";
  persist(order);

  return NextResponse.json({ id: order.id, status: order.status });
}
