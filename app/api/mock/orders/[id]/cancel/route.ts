import { NextResponse } from "next/server";
import {
  requireRole,
  findOwnedOrder,
  transition,
  persist,
  notFound,
} from "@/lib/mock/order-actions";
import {
  isReadOnly,
  readOnlyResponse,
  READ_ONLY_ACTION_MESSAGE,
} from "@/lib/mock/read-only";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (isReadOnly()) return readOnlyResponse(READ_ONLY_ACTION_MESSAGE);
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
