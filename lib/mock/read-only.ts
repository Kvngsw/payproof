import { NextResponse } from "next/server";

// The Vercel deployment serves a static dataset (lib/mock/data.json) and must
// never mutate state: every instance has its own memory, so writes would be
// invisible to other instances. Local dev keeps full in-memory writes.
// Force read-only locally with MOCK_READ_ONLY=1.
export function isReadOnly(): boolean {
  return Boolean(process.env.VERCEL) || process.env.MOCK_READ_ONLY === "1";
}

export function readOnlyResponse(message: string) {
  return NextResponse.json(
    { error: { code: "READ_ONLY", message } },
    { status: 403 },
  );
}

export const READ_ONLY_REGISTER_MESSAGE =
  "Demo deployment is read-only. Sign in as ada@kicks.com / demo1234 instead.";

export const READ_ONLY_ACTION_MESSAGE =
  "Demo deployment is read-only — this action is disabled.";

export const READ_ONLY_PROFILE_MESSAGE =
  "Demo deployment is read-only — profile changes are disabled.";
