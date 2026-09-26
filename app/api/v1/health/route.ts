/**
 * app/api/v1/health/route.ts — Health check endpoint (E23).
 *
 * WHY: Your deploy platform (Render, Railway, Vercel) needs to know if
 * your app is actually alive. This endpoint checks DB connectivity and
 * returns a 200 only if everything is healthy. 503 = something is down.
 *
 * Returns: { ok, version, rail, dbLatencyMs }
 */

import { NextResponse } from 'next/server';
import db              from '@/lib/db';
import { logger }      from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET() {
  const start = Date.now();
  let dbLatencyMs = -1;
  let dbOk = false;

  try {
    await db.$queryRaw`SELECT 1`;
    dbLatencyMs = Date.now() - start;
    dbOk = true;
  } catch (err) {
    logger.error('Health check: DB query failed', { err });
  }

  const healthy = dbOk;
  const status  = healthy ? 200 : 503;

  return NextResponse.json(
    {
      ok:          healthy,
      version:     '2.0.0',
      rail:        'monnify',
      dbLatencyMs: dbOk ? dbLatencyMs : null,
      sandbox:     process.env.MONNIFY_BASE_URL?.includes('sandbox') ?? true,
    },
    { status },
  );
}
