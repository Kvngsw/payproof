import { NextResponse } from "next/server";
import { db } from "@/lib/mock/store";

export const dynamic = "force-dynamic";

const TERMINAL = ["Completed", "Cancelled", "Disputed"];

function reputation(sellerId: string) {
  const orders = db.orders.findBySeller(sellerId);
  const terminal = orders.filter((o) => TERMINAL.includes(o.status));
  const completed = terminal.filter((o) => o.status === "Completed").length;
  const total = terminal.length;
  const score = total === 0 ? null : completed / total;

  let badge = "No history yet";
  if (score !== null && total > 0) {
    const pct = Math.round(score * 100);
    if (pct >= 95) badge = `${pct}% completed`;
    else if (pct >= 90) badge = ">90% completed";
    else if (pct >= 80) badge = ">80% completed";
    else if (pct >= 70) badge = ">70% completed";
    else badge = `${pct}% completed`;
  }

  return { score, completed, total, badge };
}

function ratingSummary(sellerId: string) {
  const stars = db.orders
    .findBySeller(sellerId)
    .map((o: { rating?: number | null }) =>
      typeof o.rating === "number" ? o.rating : null,
    )
    .filter((s): s is number => s !== null);
  if (stars.length === 0) return { average: null, count: 0 };
  return {
    average: stars.reduce((sum, s) => sum + s, 0) / stars.length,
    count: stars.length,
  };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const seller = db.sellers.findById(id);
  if (!seller) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Seller not found." } },
      { status: 404 },
    );
  }

  return NextResponse.json({
    id: seller.id,
    business_name: seller.business_name,
    reputation: reputation(seller.id),
    rating: ratingSummary(seller.id),
  });
}
