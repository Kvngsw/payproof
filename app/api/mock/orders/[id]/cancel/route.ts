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

  const result = transition(order, "Cancelled", "buyer", ["Pending Payment"], "Cancelled before payment");
  if (result instanceof NextResponse) return result;

  persist(order);

  return NextResponse.json({ id: order.id, status: order.status });
}
