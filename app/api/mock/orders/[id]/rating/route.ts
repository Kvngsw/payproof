import { NextResponse } from "next/server";
import {
  requireRole,
  findOwnedOrder,
  invalidTransition,
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

  if (order.rating != null) {
    return NextResponse.json(
      {
        error: {
          code: "DUPLICATE",
          message: "This order has already been rated.",
        },
      },
      { status: 409 },
    );
  }

  if (order.status !== "Completed") return invalidTransition(order.status);

  const body = (await request.json().catch(() => null)) as {
    stars?: unknown;
  } | null;
  const stars = body?.stars;
  if (!Number.isInteger(stars) || (stars as number) < 1 || (stars as number) > 5) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION",
          message: "Stars must be an integer between 1 and 5.",
        },
      },
      { status: 400 },
    );
  }

  order.rating = stars as number;
  persist(order);

  return NextResponse.json({
    id: order.id,
    status: order.status,
    rating: order.rating,
  });
}
