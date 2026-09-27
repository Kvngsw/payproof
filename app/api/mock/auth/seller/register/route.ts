import { NextResponse } from "next/server";
import { db, generateId, hashPassword } from "@/lib/mock/store";
import { issueOtp } from "@/lib/mock/otp";
import {
  isReadOnly,
  readOnlyResponse,
  READ_ONLY_REGISTER_MESSAGE,
} from "@/lib/mock/read-only";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (isReadOnly()) return readOnlyResponse(READ_ONLY_REGISTER_MESSAGE);
  try {
    const body = await request.json();
    const { name, email, password, phone, business_name } = body;

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: { code: "VALIDATION", message: "Missing required fields" } },
        { status: 400 }
      );
    }

    const cleanEmail = String(email).trim().toLowerCase();

    const duplicate = "An account with this email already exists. Please log in.";
    if (db.sellers.findByEmail(cleanEmail)) {
      return NextResponse.json(
        { error: { code: "DUPLICATE", message: duplicate } },
        { status: 409 }
      );
    }
    if (db.buyers.findByEmail(cleanEmail)) {
      return NextResponse.json(
        { error: { code: "DUPLICATE", message: duplicate } },
        { status: 409 }
      );
    }

    const id = generateId();
    const password_hash = hashPassword(password);
    const created_at = new Date().toISOString();

    const reserved_account_number = "99" + Math.floor(10000000 + Math.random() * 90000000);
    const reserved_bank = "Wema Bank";
    const displayName = String(business_name ?? "").trim() || String(name).trim();
    const reserved_account_name = `PP-${displayName.toUpperCase()}`;

    const seller = {
      id,
      email: cleanEmail,
      password_hash,
      name,
      phone: String(phone ?? "").trim(),
      business_name: String(business_name ?? "").trim(),
      reserved_account_number,
      reserved_bank,
      reserved_account_name,
      created_at,
    };

    db.sellers.insert(seller);

    // Auth v2: no token at register — OTP verification at /otp signs them in.
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
