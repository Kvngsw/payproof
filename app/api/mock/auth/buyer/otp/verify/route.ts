import { NextResponse } from "next/server";
import { db } from "@/lib/mock/store";
import { issueToken } from "@/lib/mock/auth";
import { isReadOnly } from "@/lib/mock/read-only";
import { READ_ONLY_OTP_CODE } from "@/lib/mock/otp";

export const dynamic = "force-dynamic";

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

    const buyer = db.buyers.findByEmail(email);
    if (!buyer) {
      if (isReadOnly()) {
        return NextResponse.json(
          {
            error: {
              code: "READ_ONLY",
              message:
                "Demo deployment is read-only — no account for this email. Sign in as hauwa@example.com (code 123456).",
            },
          },
          { status: 403 },
        );
      }
      // Auth v2 (A3): OTP no longer auto-creates buyer accounts.
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION",
            message: "No account found for this email. Please sign up first.",
          },
        },
        { status: 400 }
      );
    }

    const token = issueToken({ sub: buyer.id, role: "buyer", name: email.split("@")[0], email });

    return NextResponse.json({
      token,
      buyer: {
        id: buyer.id,
        email: buyer.email,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: { code: "VALIDATION", message: err.message || "Invalid request" } },
      { status: 400 }
    );
  }
}
