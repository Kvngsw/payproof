import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/mock/auth";
import { db, readCollection } from "@/lib/mock/store";

type User = NonNullable<ReturnType<typeof verifyToken>>;

export interface MockOrderRow {
  id: string;
  seller_id: string;
  buyer_email?: string;
  status: string;
  rating?: number | null;
  amounts: { product_kobo: number; dispatch_fee_kobo: number; total_kobo: number };
  events: { from: string; to: string; actor: string; at: string; note: string | null }[];
  payout: { status: string };
  payment: { verification_mode: string; paid_at: string | null; reference?: string };
  updated_at: string;
  [key: string]: unknown;
}

export function requireRole(request: Request, role: "seller" | "buyer") {
  const user = verifyToken(request.headers.get("authorization"));
  if (!user || user.role !== role) {
    return {
      error: NextResponse.json(
        {
          error: {
            code: "UNAUTHENTICATED",
            message: `${role === "seller" ? "Seller" : "Buyer"} token required`,
          },
        },
        { status: 401 },
      ),
    };
  }
  return { user };
}

export function ownsOrder(order: MockOrderRow, user: User): boolean {
  if (user.role === "seller") return order.seller_id === user.sub;
  return !order.buyer_email || order.buyer_email === user.email;
}

export function findOrder(id: string): MockOrderRow | null {
  return (readCollection("orders").find((o) => o.id === id) as MockOrderRow) ?? null;
}

export function findOwnedOrder(id: string, user: User): MockOrderRow | null {
  const order = findOrder(id);
  if (!order || !ownsOrder(order, user)) return null;
  return order;
}

export function notFound(message = "Order not found") {
  return NextResponse.json(
    { error: { code: "NOT_FOUND", message } },
    { status: 404 },
  );
}

export function invalidTransition(status: string) {
  return NextResponse.json(
    {
      error: {
        code: "INVALID_TRANSITION",
        message: `Cannot do that to an order in status "${status}"`,
      },
    },
    { status: 409 },
  );
}

export function transition(
  order: MockOrderRow,
  to: string,
  actor: "system" | "seller" | "buyer",
  allowedFrom: string[],
  note: string | null = null,
): string | NextResponse {
  if (!allowedFrom.includes(order.status)) return invalidTransition(order.status);
  const now = new Date().toISOString();
  order.events.push({
    from: order.status,
    to,
    actor,
    at: now,
    note,
  });
  order.status = to;
  order.updated_at = now;
  return to;
}

export function persist(order: MockOrderRow) {
  db.orders.updateById(order.id, (o) => Object.assign(o, order));
}
