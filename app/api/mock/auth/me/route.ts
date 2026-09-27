import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/mock/auth";
import { db } from "@/lib/mock/store";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const user = verifyToken(authHeader);

  if (!user) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Invalid or missing token" } },
      { status: 401 }
    );
  }

  if (user.role === "seller") {
    const seller = db.sellers.findById(user.sub);
    if (!seller) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Seller not found" } },
        { status: 404 }
      );
    }
    const { password_hash, ...profile } = seller;
    return NextResponse.json({
      role: "seller",
      profile,
      reserved_account: {
        account_number: seller.reserved_account_number,
        bank_name: seller.reserved_bank,
        account_name: seller.reserved_account_name,
      },
    });
  } else {
    const buyer = db.buyers.findById(user.sub);
    if (!buyer) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Buyer not found" } },
        { status: 404 }
      );
    }
    const { password_hash, ...profile } = buyer;
    return NextResponse.json({
      role: "buyer",
      profile,
    });
  }
}
