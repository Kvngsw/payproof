import { NextResponse } from "next/server";
import { db } from "@/lib/mock/store";
import { issueToken } from "@/lib/mock/auth";
import { isReadOnly } from "@/lib/mock/read-only";
import { READ_ONLY_OTP_CODE } from "@/lib/mock/otp";

export const dynamic = "force-dynamic";

// Auth v2: role-agnostic OTP verify — issues a token for whichever account
// owns the email (seller checked first, matching /auth/login).
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, code } = body;

    if (!email || !code) {
      return NextResponse.json(
        { error: { code: "VALIDATION", message: "Email and code required" } },
        { status: 400 }
      );
    }

    if (isReadOnly()) {
      // Nothing can be stored read-only: accept the static dev code instead.
      if (code !== READ_ONLY_OTP_CODE) {
        return NextResponse.json(
          { error: { code: "VALIDATION", message: "Invalid OTP code" } },
          { status: 400 }
        );
      }
    } else {
      const otpRecord = db.otps.findLatestByEmail(email);

      if (!otpRecord) {
        return NextResponse.json(
          { error: { code: "VALIDATION", message: "No active OTP request found for this email" } },
          { status: 400 }
        );
      }

      if (otpRecord.attempts >= 5) {
        return NextResponse.json(
          { error: { code: "RATE_LIMITED", message: "Too many failed attempts. Request a new code." } },
          { status: 429 }
        );
      }

      if (otpRecord.expires_at < Date.now()) {
        return NextResponse.json(
          { error: { code: "VALIDATION", message: "OTP code expired" } },
          { status: 400 }
        );
      }

      if (otpRecord.code !== code) {
        db.otps.updateAttempts(otpRecord.id, otpRecord.attempts + 1);
        return NextResponse.json(
          { error: { code: "VALIDATION", message: "Invalid OTP code" } },
          { status: 400 }
        );
      }

      db.otps.markUsed(otpRecord.id, new Date().toISOString());
    }

    const seller = db.sellers.findByEmail(email);
    if (seller) {
      const token = issueToken({
        sub: seller.id,
        role: "seller",
        name: seller.name,
        email: seller.email,
      });
      return NextResponse.json({ token, role: "seller" });
    }

    const buyer = db.buyers.findByEmail(email);
    if (buyer) {
      const token = issueToken({
        sub: buyer.id,
        role: "buyer",
        name: buyer.name ?? email.split("@")[0],
        email: buyer.email,
      });
      return NextResponse.json({ token, role: "buyer" });
    }

    return NextResponse.json(
      { error: { code: "VALIDATION", message: "No account found for this email" } },
      { status: 400 }
    );
  } catch (err) {
    return NextResponse.json(
      { error: { code: "VALIDATION", message: err instanceof Error ? err.message : "Invalid request" } },
      { status: 400 }
    );
  }
}
