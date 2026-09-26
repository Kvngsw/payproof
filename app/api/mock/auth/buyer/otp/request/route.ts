import { NextResponse } from "next/server";
import { db, generateId } from "@/lib/mock/store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { error: { code: "VALIDATION", message: "Email required" } },
        { status: 400 }
      );
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const id = generateId();
    const expires_at = Date.now() + 600000; // 10 mins

    db.otps.insert({
      id,
      email,
      code,
      expires_at,
      attempts: 0,
      used_at: null,
    });

    return NextResponse.json(
      {
        sent: true,
        delivery: "dev_screen",
        dev_code: code,
      },
      { status: 202 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: { code: "VALIDATION", message: err.message || "Invalid request" } },
      { status: 400 }
    );
  }
}
