import { NextResponse } from "next/server";
import { db, verifyPassword } from "@/lib/mock/store";
import { issueOtp } from "@/lib/mock/otp";

export const dynamic = "force-dynamic";

// Auth v2: password check for either role, then OTP (no token issued yet).
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

    const seller = db.sellers.findByEmail(email);
    const buyer = db.buyers.findByEmail(email);

    const sellerOk =
      seller?.password_hash && verifyPassword(password, seller.password_hash);
    const buyerOk =
      buyer?.password_hash && verifyPassword(password, buyer.password_hash);

    if (!sellerOk && !buyerOk) {
      return NextResponse.json(
        {
          error: {
            code: "UNAUTHENTICATED",
            message: "Invalid email or password",
          },
        },
        { status: 401 }
      );
    }

    const role = sellerOk ? "seller" : "buyer";
    const dev_code = issueOtp(email);

    return NextResponse.json(
      { sent: true, role, delivery: "dev_screen", dev_code },
      { status: 202 }
    );
  } catch (err) {
    return NextResponse.json(
      { error: { code: "VALIDATION", message: err instanceof Error ? err.message : "Invalid request" } },
      { status: 400 }
    );
  }
}
