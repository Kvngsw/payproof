import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/mock/auth";
import { db } from "@/lib/mock/store";
import { ORDER_STATUSES } from "@/lib/mock/seed";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const user = verifyToken(authHeader);

  if (!user || user.role !== "seller") {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Seller token required" } },
      { status: 401 }
    );
  }

  const seller = db.sellers.findById(user.sub);
  if (!seller) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Seller not found" } },
      { status: 404 }
    );
  }

  const orders = db.orders.findBySeller(seller.id);

  const counts_by_status: Record<string, number> = {};
  for (const status of ORDER_STATUSES) counts_by_status[status] = 0;
  const payouts = { pending_kobo: 0, paid_kobo: 0, frozen_kobo: 0 };

  for (const order of orders) {
    counts_by_status[order.status] = (counts_by_status[order.status] ?? 0) + 1;
    const payoutStatus = order.payout?.status;
    if (payoutStatus === "pending") {
      payouts.pending_kobo += order.amounts.total_kobo;
    } else if (payoutStatus === "paid") {
      payouts.paid_kobo += order.amounts.total_kobo;
    } else if (payoutStatus === "frozen") {
      payouts.frozen_kobo += order.amounts.total_kobo;
    }
  }

  return NextResponse.json({
    reserved_account: {
      account_number: seller.reserved_account_number,
      bank_name: seller.reserved_bank,
      account_name: seller.reserved_account_name,
    },
    counts_by_status,
    payouts,
  });
}
