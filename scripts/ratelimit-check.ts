/**
 * scripts/ratelimit-check.ts — Prove 429s fire on action routes.
 * Hammers cancel on an already-terminal order 12× (all 409s, no state
 * change, no rail calls) and asserts the budget trips to 429.
 * Run against dev server: npx tsx --env-file=.env.local scripts/ratelimit-check.ts
 */
import db from '../lib/db';

const BASE = 'http://localhost:3000/api/v1';

async function main() {
  // Buyer login via dev OTP.
  const email = 'tobi@payproof.ng';
  const otpReq = await fetch(BASE + '/auth/buyer/otp/request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  const { dev_code } = (await otpReq.json()) as { dev_code: string };
  const otpVerify = await fetch(BASE + '/auth/buyer/otp/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code: dev_code }),
  });
  const { token } = (await otpVerify.json()) as { token: string };
  const auth = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  // Any terminal order owned by this buyer: cancel → 409 every time.
  const buyer = await db.buyer.findUnique({ where: { email } });
  const order = await db.order.findFirst({
    where: { buyerId: buyer!.id, status: { in: ['Completed', 'Cancelled', 'Disputed'] } },
  });
  if (!order) throw new Error('No terminal order for buyer — run e2e-smoke first');

  const statuses: number[] = [];
  // Cancel budget is 20/min → first 20 pass through (409s), 21st+ must 429.
  for (let i = 0; i < 22; i++) {
    const r = await fetch(`${BASE}/orders/${order.id}/cancel`, { method: 'POST', headers: auth });
    statuses.push(r.status);
  }

  console.log('STATUSES=' + statuses.join(','));
  const first20 = statuses.slice(0, 20);
  const rest = statuses.slice(20);
  const ok = first20.every((s) => s === 409) && rest.every((s) => s === 429);
  console.log(`RESULT first20_all409=${first20.every((s) => s === 409)} rest_all429=${rest.every((s) => s === 429)}`);
  if (!ok) {
    console.log('RATELIMIT_FAIL: expected twenty 409s then 429s');
    process.exit(1);
  }
  console.log('RATELIMIT_OK: budget trips, state untouched');
  process.exit(0);
}

main().catch((err) => {
  console.error('RATELIMIT_CRASH: ' + (err as Error).message);
  process.exit(1);
});
