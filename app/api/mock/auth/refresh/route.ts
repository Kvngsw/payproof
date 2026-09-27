import { NextResponse } from "next/server";
import { issueToken, verifyToken } from "@/lib/mock/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = verifyToken(request.headers.get("authorization"));
  if (!user) {
    return NextResponse.json(
      {
        error: {
          code: "UNAUTHENTICATED",
          message: "Session expired. Please log in again.",
        },
      },
      { status: 401 },
    );
  }

  const token = issueToken({
    sub: user.sub,
    role: user.role,
    name: user.name,
    email: user.email,
  });

  return NextResponse.json({ token });
}
