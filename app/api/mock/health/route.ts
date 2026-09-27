import { NextResponse } from "next/server";
import { readCollection } from "@/lib/mock/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const start = performance.now();
  readCollection("sellers");
  const dbLatencyMs = Math.round(performance.now() - start);

  return NextResponse.json({
    ok: true,
    version: "mock",
    rail: "mock",
    dbLatencyMs,
    sandbox: true,
  });
}
