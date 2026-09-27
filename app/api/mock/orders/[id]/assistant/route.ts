import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/mock/auth";
import { findOwnedOrder, notFound } from "@/lib/mock/order-actions";

export const dynamic = "force-dynamic";

const ANSWERS: Record<string, string> = {
  "Pending Payment":
    "This order is waiting for payment to land. Once the buyer pays, PayProof confirms it directly from the bank and the order moves forward. No screenshot can move this order.",
  Paid: "Payment is confirmed and the money is locked with PayProof. The seller is preparing the package for shipment.",
  "Awaiting Shipment":
    "Payment is locked in escrow. The seller has not shipped yet. If nothing happens for too long, you can cancel or report an issue.",
  Shipped: "The package is on its way. Track it with the tracking number on this page. Your money stays locked until you confirm delivery.",
  Delivered:
    "The package has been marked delivered. Confirm delivery on this page to release the seller's payout.",
  Completed:
    "This order is complete. The seller has been paid and the payout is settled.",
  Cancelled: "This order was cancelled. Nothing will move anymore.",
  Disputed:
    "This order is disputed, so the payout is frozen exactly where it is. PayProof will hold the funds until the issue is resolved.",
};

export async function POST(
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

  const body = await request.json().catch(() => null);
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  if (message.length < 1 || message.length > 1000) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION",
          message: "message must be between 1 and 1000 characters",
        },
      },
      { status: 400 },
    );
  }

  return NextResponse.json({
    answer: ANSWERS[order.status] ?? `This order is currently "${order.status}".`,
    order_status: order.status,
    scope: "order",
  });
}
