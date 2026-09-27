import { NextResponse } from "next/server";
import { db, generateId, hashPassword } from "@/lib/mock/store";
import { issueToken } from "@/lib/mock/auth";
import { ensureDemoData } from "@/lib/mock/seed";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, password, phone, business_name } = body;

    if (!name || !email || !password || !phone || !business_name) {
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
    const reserved_account_name = `PP-${business_name.toUpperCase()}`;

    const seller = {
      id,
      email,
      password_hash,
      name,
      phone,
      business_name,
      reserved_account_number,
      reserved_bank,
      reserved_account_name,
      created_at,
    };

    db.sellers.insert(seller);

    const token = issueToken({ sub: id, role: "seller", name, email });

    return NextResponse.json(
      {
        token,
        seller: {
          id,
          name,
          email,
          phone,
          business_name,
          created_at,
        },
        reserved_account: {
          account_number: reserved_account_number,
          bank_name: reserved_bank,
          account_name: reserved_account_name,
        },
      },
      { status: 201 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: { code: "VALIDATION", message: err.message || "Invalid request" } },
      { status: 400 }
    );
  }
}
