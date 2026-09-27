import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/mock/auth";
import { db } from "@/lib/mock/store";
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
  const authHeader = request.headers.get("authorization");
  const user = verifyToken(authHeader);

  if (!user || user.role !== "seller") {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Seller token required" } },
      { status: 401 }
    );
  }

  const { id } = await params;
  const seller = db.sellers.findById(user.sub);
  if (!seller) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Seller not found" } },
      { status: 404 }
    );
  }

  const order = db.orders.findBySeller(seller.id).find((o) => o.id === id);
  if (!order) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Order not found" } },
      { status: 404 }
    );
  }

  if (order.status !== "Awaiting Shipment") {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_TRANSITION",
          message: `Cannot ship an order in status "${order.status}"`,
        },
      },
      { status: 409 }
    );
  }

  let body: { tracking_number?: string; carrier?: string } = {};
  try {
    body = await request.json();
  } catch {}

  const now = new Date().toISOString();

  const updated = db.orders.updateById(order.id, (o) => {
    o.status = "Shipped";
    o.tracking = {
      status: "Picked Up",
      number: body.tracking_number?.trim() || null,
      carrier: body.carrier?.trim() || null,
      source: "manual",
      label: "Manually updated by seller",
    };
    o.events.push({
      from: "Awaiting Shipment",
      to: "Shipped",
      actor: "seller",
      at: now,
      note: null,
    });
    o.updated_at = now;
  });

  return NextResponse.json({
    ...updated,
    seller: { id: seller.id, business_name: seller.business_name },
  });
}
