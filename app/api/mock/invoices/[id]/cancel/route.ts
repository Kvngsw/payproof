import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/mock/auth";
import { db } from "@/lib/mock/store";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = verifyToken(request.headers.get("authorization"));
  if (!user || user.role !== "seller") {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Seller token required" } },
      { status: 401 }
    );
  }

  const { id } = await params;
  const invoice = db.invoices
    .findBySeller(user.sub)
    .find((i) => i.id.toUpperCase() === id.toUpperCase());
  if (!invoice) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Invoice not found" } },
      { status: 404 }
    );
  }

  if (invoice.status !== "pending") {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_TRANSITION",
          message: `Only pending invoices can be cancelled (status: ${invoice.status})`,
        },
      },
      { status: 409 }
    );
  }

  const updated = db.invoices.updateById(invoice.id, (i) => {
    i.status = "cancelled";
  });
  return NextResponse.json(updated);
}
