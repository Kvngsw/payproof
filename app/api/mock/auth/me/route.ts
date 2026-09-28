import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/mock/auth";
import { db } from "@/lib/mock/store";
import {
  isReadOnly,
  readOnlyResponse,
  READ_ONLY_PROFILE_MESSAGE,
} from "@/lib/mock/read-only";

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

export async function PATCH(request: Request) {
  if (isReadOnly()) return readOnlyResponse(READ_ONLY_PROFILE_MESSAGE);
  const user = verifyToken(request.headers.get("authorization"));

  if (user && user.role === "buyer") {
    // A7 buyer branch: buyers may update name + phone only.
    let body: Record<string, unknown> = {};
    try {
      body = await request.json();
    } catch {}

    if ("business_name" in body || "bvn" in body || "settlement" in body) {
      return NextResponse.json(
        { error: { code: "VALIDATION", message: "Buyers can only update name and phone" } },
        { status: 400 },
      );
    }

    const patch: Record<string, unknown> = {};
    if ("name" in body) {
      const name = String(body.name ?? "").trim();
      if (!name) {
        return NextResponse.json(
          { error: { code: "VALIDATION", message: "Name cannot be empty" } },
          { status: 400 },
        );
      }
      patch.name = name;
    }
    if ("phone" in body) patch.phone = String(body.phone ?? "").trim();

    if (Object.keys(patch).length === 0) {
      return NextResponse.json(
        { error: { code: "VALIDATION", message: "No fields to update" } },
        { status: 400 },
      );
    }

    const updated = db.buyers.update(user.sub, patch);
    if (!updated) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Buyer not found" } },
        { status: 404 },
      );
    }

    const row = db.buyers.findById(user.sub) ?? {};
    const profile = { ...row };
    delete profile.password_hash;
    return NextResponse.json({ role: "buyer", profile });
  }

  if (!user || user.role !== "seller") {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Seller token required" } },
      { status: 401 },
    );
  }

  const seller = db.sellers.findById(user.sub);
  if (!seller) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Seller not found" } },
      { status: 404 },
    );
  }

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {}

  const patch: Record<string, unknown> = {};

  if ("name" in body) {
    const name = String(body.name ?? "").trim();
    if (!name) {
      return NextResponse.json(
        { error: { code: "VALIDATION", message: "Name cannot be empty" } },
        { status: 400 },
      );
    }
    patch.name = name;
  }

  if ("phone" in body) patch.phone = String(body.phone ?? "").trim();
  if ("business_name" in body)
    patch.business_name = String(body.business_name ?? "").trim();

  if ("bvn" in body) {
    const bvn = String(body.bvn ?? "").trim();
    if (bvn && !/^\d{11}$/.test(bvn)) {
      return NextResponse.json(
        { error: { code: "VALIDATION", message: "BVN must be 11 digits" } },
        { status: 400 },
      );
    }
    patch.bvn = bvn;
  }

  if ("settlement" in body) {
    const raw =
      (body.settlement as { bankCode?: unknown; accountNumber?: unknown } | null) ??
      {};
    const bankCode = String(raw.bankCode ?? "").trim();
    const accountNumber = String(raw.accountNumber ?? "").trim();
    if (bankCode || accountNumber) {
      if (!/^\d{10}$/.test(accountNumber)) {
        return NextResponse.json(
          {
            error: {
              code: "VALIDATION",
              message: "Settlement account number must be 10 digits",
            },
          },
          { status: 400 },
        );
      }
      if (!bankCode) {
        return NextResponse.json(
          { error: { code: "VALIDATION", message: "Bank code is required" } },
          { status: 400 },
        );
      }
      patch.settlement = { bankCode, accountNumber };
    } else {
      patch.settlement = null;
    }
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json(
      { error: { code: "VALIDATION", message: "No fields to update" } },
      { status: 400 },
    );
  }

  const updated = db.sellers.update(user.sub, patch);
  if (!updated) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Seller not found" } },
      { status: 404 },
    );
  }

  // Keep the reserved account name in step with the public business name.
  if ("business_name" in patch || "name" in patch) {
    const displayName =
      updated.business_name?.trim() || updated.name?.trim() || "SELLER";
    db.sellers.update(user.sub, {
      reserved_account_name: `PP-${displayName.toUpperCase()}`,
    });
  }

  const row = db.sellers.findById(user.sub) ?? {};
  const profile = { ...row };
  delete profile.password_hash;
  return NextResponse.json({
    role: "seller",
    profile,
    reserved_account: {
      account_number: profile.reserved_account_number,
      bank_name: profile.reserved_bank,
      account_name: profile.reserved_account_name,
    },
  });
}
