import db from './db';

export interface ReputationResult {
  score:     number | null;
  completed: number;
  total:     number;
  badge:     string;
}

export async function getReputation(sellerId: string): Promise<ReputationResult> {

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

export function computeScore(completed: number, total: number): number | null { // D4: terminal states only — in-flight orders must not dent the badge
  if (total === 0) return null;
  return completed / total;
}

export function computeBadge(score: number | null, total: number): string { // server-computed: clients never decide badges
  if (score === null || total === 0) return 'No history yet';
  const pct = Math.round(score * 100);
  if (pct >= 95) return `${pct}% completed`;
  if (pct >= 90) return `>${90}% completed`;
  if (pct >= 80) return `>${80}% completed`;
  if (pct >= 70) return `>${70}% completed`;
  return `${pct}% completed`;
}
