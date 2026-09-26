import { NextResponse } from "next/server";
import { db } from "@/lib/mock/store";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const invoice = db.invoices.findByCode(id);
  if (!invoice) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Invoice not found" } },
      { status: 404 }
    );
  }

  const seller = db.sellers.findById(invoice.seller_id);
  return NextResponse.json({
    ...invoice,
    seller: {
      business_name: seller?.business_name ?? seller?.name ?? "Seller",
    },
  });
}
