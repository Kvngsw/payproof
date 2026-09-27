import { NextResponse } from "next/server";
import { db, generateId, hashPassword } from "@/lib/mock/store";
import { ensureDemoData } from "@/lib/mock/seed";
import { issueOtp } from "@/lib/mock/otp";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, password, phone, business_name } = body;

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: { code: "VALIDATION", message: "Missing required fields" } },
        { status: 400 }
      );
    }

    ensureDemoData();
    const existing = db.sellers.findByEmail(email);
    if (existing) {
      return NextResponse.json(
        { error: { code: "DUPLICATE", message: "Email already registered" } },
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
      email,
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
    const dev_code = issueOtp(email);

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
