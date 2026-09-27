import { NextResponse } from "next/server";
import { db, generateId, hashPassword } from "@/lib/mock/store";
import { issueOtp } from "@/lib/mock/otp";
import {
  isReadOnly,
  readOnlyResponse,
  READ_ONLY_REGISTER_MESSAGE,
} from "@/lib/mock/read-only";

export const dynamic = "force-dynamic";

// Auth v2: buyer account creation with a password, OTP confirms the email.
export async function POST(request: Request) {
  if (isReadOnly()) return readOnlyResponse(READ_ONLY_REGISTER_MESSAGE);
  try {
    const body = await request.json();
    const { name, email, password } = body;

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: { code: "VALIDATION", message: "Name, email and password required" } },
        { status: 400 }
      );
    }

    if (String(password).length < 8) {
      return NextResponse.json(
        { error: { code: "VALIDATION", message: "Password must be at least 8 characters" } },
        { status: 400 }
      );
    }

    const cleanEmail = String(email).trim().toLowerCase();

    if (db.sellers.findByEmail(cleanEmail)) {
      return NextResponse.json(
        { error: { code: "DUPLICATE", message: "Email already registered — sign in instead" } },
        { status: 409 }
      );
    }

    const existing = db.buyers.findByEmail(cleanEmail);
    if (existing?.password_hash) {
      return NextResponse.json(
        { error: { code: "DUPLICATE", message: "Email already registered — sign in instead" } },
        { status: 409 }
      );
    }

    if (existing) {
      // Legacy OTP-only buyer (no password) adopts the new credentials.
      db.buyers.update(existing.id, { name, password_hash: hashPassword(password) });
    } else {
      db.buyers.insert({
        id: generateId(),
        name,
        email: cleanEmail,
        password_hash: hashPassword(password),
        created_at: new Date().toISOString(),
      });
    }

    const dev_code = issueOtp(cleanEmail);

    return NextResponse.json(
      { sent: true, delivery: "dev_screen", dev_code },
      { status: 202 }
    );
  } catch (err) {
    return NextResponse.json(
      { error: { code: "VALIDATION", message: err instanceof Error ? err.message : "Invalid request" } },
      { status: 400 }
    );
  }
}
