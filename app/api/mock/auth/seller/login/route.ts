import { NextResponse } from "next/server";
import { db, verifyPassword } from "@/lib/mock/store";
import { issueToken } from "@/lib/mock/auth";
import { ensureDemoData } from "@/lib/mock/seed";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: { code: "VALIDATION", message: "Email and password required" } },
        { status: 400 }
      );
    }

    ensureDemoData();
    const seller = db.sellers.findByEmail(email);

    if (!seller || !verifyPassword(password, seller.password_hash)) {
      return NextResponse.json(
        { error: { code: "UNAUTHENTICATED", message: "Invalid email or password" } },
        { status: 401 }
      );
    }

    const token = issueToken({ sub: seller.id, role: "seller", name: seller.name, email: seller.email });

    return NextResponse.json({
      token,
      seller: {
        id: seller.id,
        name: seller.name,
        email: seller.email,
        phone: seller.phone,
        business_name: seller.business_name,
        created_at: seller.created_at,
      },
      reserved_account: {
        account_number: seller.reserved_account_number,
        bank_name: seller.reserved_bank,
        account_name: seller.reserved_account_name,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: { code: "VALIDATION", message: err.message || "Invalid request" } },
      { status: 400 }
    );
  }
}
