import { NextResponse } from "next/server";
import { issueOtp } from "@/lib/mock/otp";

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

    const code = issueOtp(email);

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
