import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/mock/auth";
import { db } from "@/lib/mock/store";
import { TRACKING_STATUSES } from "@/lib/mock/seed";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
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

  let body: { tracking_status?: string; tracking_number?: string } = {};
  try {
    body = await request.json();
  } catch {}

  const nextStatus = body.tracking_status;
  if (!nextStatus || !TRACKING_STATUSES.includes(nextStatus as any)) {
    return NextResponse.json(
      { error: { code: "VALIDATION", message: "Invalid tracking status" } },
      { status: 400 }
    );
  }

  const current = order.tracking?.status;
  if (!current) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_TRANSITION",
          message: "Order has not been shipped yet",
        },
      },
      { status: 409 }
    );
  }

  const currentIndex = TRACKING_STATUSES.indexOf(current as any);
  const nextIndex = TRACKING_STATUSES.indexOf(nextStatus as any);

  if (currentIndex === -1 || nextIndex < currentIndex) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_TRANSITION",
          message: `Cannot move tracking from "${current}" to "${nextStatus}"`,
        },
      },
      { status: 409 }
    );
  }

  const now = new Date().toISOString();

  const updated = db.orders.updateById(order.id, (o) => {
    o.tracking = {
      ...o.tracking,
      status: nextStatus,
      number: body.tracking_number?.trim() || o.tracking?.number || null,
      source: "manual",
      label: "Manually updated by seller",
    };

    if (nextStatus === "Delivered" && o.status === "Shipped") {
      o.status = "Delivered";
      o.events.push({
        from: "Shipped",
        to: "Delivered",
        actor: "seller",
        at: now,
        note: null,
      });
    }

    o.updated_at = now;
  });

  return NextResponse.json({
    ...updated,
    seller: { id: seller.id, business_name: seller.business_name },
  });
}
