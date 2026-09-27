import { NextResponse } from "next/server";
import { db, generateId } from "@/lib/mock/store";
import { issueToken } from "@/lib/mock/auth";
import { ensureDemoData } from "@/lib/mock/seed";

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

    ensureDemoData(); // buyer sessions can be the first on a fresh store

    let buyer = db.buyers.findByEmail(email);
    if (!buyer) {
      const buyerId = generateId();
      const created_at = new Date().toISOString();
      buyer = { id: buyerId, email, created_at };
      db.buyers.insert(buyer);
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
