/**
 * lib/reputation.ts — Real seller reputation computation.
 *
 * WHY: Never hardcode, never mock, never cache stale.
 * The reputation score is computed from real order history via a single
 * aggregation SQL query. It recomputes whenever called — no in-memory cache.
 *
 * Formula (D4 ruling from spec §7.8):
 *   score = completed / (completed + cancelled + disputed)
 *   badge = computed server-side from score
 *
 * This is the D4 version (recommended) rather than the spec-literal version
 * (which counts all orders including in-flight, distorting the badge).
 */

import db from './db';

export interface ReputationResult {
  score:     number | null;   // null = no history
  completed: number;
  total:     number;
  badge:     string;
}

/**
 * Compute reputation for a seller.
 * Uses a single aggregation query — no N+1, no loops.
 */
export async function getReputation(sellerId: string): Promise<ReputationResult> {
  // Raw SQL aggregation for performance and spec-exact semantics.
  // Prisma's groupBy doesn't support FILTER clauses, so we use $queryRaw.
  const rows = await db.$queryRaw<
    Array<{
      completed: bigint;
      total:     bigint;
      score:     number | null;
    }>
  >`
    SELECT
      COUNT(*) FILTER (WHERE status = 'Completed')                                  AS completed,
      COUNT(*) FILTER (WHERE status IN ('Completed', 'Cancelled', 'Disputed'))      AS total,
      COUNT(*) FILTER (WHERE status = 'Completed')::float
        / NULLIF(
            COUNT(*) FILTER (WHERE status IN ('Completed', 'Cancelled', 'Disputed')),
            0
          )                                                                          AS score
    FROM orders
    WHERE "sellerId" = ${sellerId}
  `;

  const row = rows[0];
  if (!row) {
    return { score: null, completed: 0, total: 0, badge: 'No history yet' };
  }

  const completed = Number(row.completed);
  const total     = Number(row.total);
  const score     = computeScore(completed, total);

  return {
    score,
    completed,
    total,
    badge: computeBadge(score, total),
  };
}

/**
 * Pure score computation — unit tested without a database.
 * Denominator = terminal states only (D4 ruling, spec §7.8).
 */
export function computeScore(completed: number, total: number): number | null {
  if (total === 0) return null;
  return completed / total;
}

/**
 * Compute a human-readable badge from the score.
 * Badge thresholds are server-computed — never hardcoded on the client.
 */
export function computeBadge(score: number | null, total: number): string {
  if (score === null || total === 0) return 'No history yet';
  const pct = Math.round(score * 100);
  if (pct >= 95) return `${pct}% completed`;
  if (pct >= 90) return `>${90}% completed`;
  if (pct >= 80) return `>${80}% completed`;
  if (pct >= 70) return `>${70}% completed`;
  return `${pct}% completed`;
}
