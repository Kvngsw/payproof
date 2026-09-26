/**
 * scripts/rail-spike.ts — BE-01 rail proof (Monnify sandbox).
 * Each of init + verify + reserved-account is hit once against the real API.
 * Run: npx tsx --env-file=.env.local scripts/rail-spike.ts
 *
 * Exit 0 = rail proven. Non-zero = BE-01 finding (see risk B1/B3).
 */
import {
  getToken,
  createReservedAccount,
  initializeTransaction,
  verifyTransaction,
} from '../lib/monnify';

async function main() {
  // 1. Auth — proves API key/secret + connectivity.
  const token = await getToken();
  console.log('SPIKE token_ok=' + (token.length > 10));

  // 2. Reserved account — proves contract code + BVN acceptance.
  // Sandbox test identity, clearly labelled.
  let reserved: { accountNumber: string; bankName: string; accountName: string };
  try {
    reserved = await createReservedAccount({
      userId: 'spike-test',
      name: 'Spike Test',
      email: 'spike@payproof.ng',
      bvn: '22222222222',
    });
    console.log('SPIKE reserved_ok=true ' + JSON.stringify({ bank: reserved.bankName }));
  } catch (err) {
    console.log('SPIKE reserved_ok=false reason=' + (err as Error).message.slice(0, 200));
    throw err;
  }

  // 3. Init transaction — proves contract + checkout flow (no money moves).
  const ref = `spike_${Date.now().toString(36)}`;
  const init = await initializeTransaction({
    ref,
    totalKobo: 500000, // ₦5,000 test amount
    productName: 'Spike Test Product',
    buyerEmail: 'spike-buyer@payproof.ng',
    redirectUrl: 'http://localhost:3000/orders/spike/return',
  });
  console.log('SPIKE init_ok=true ref=' + init.reference);

  // 4. Verify — proves query flow (status will be unpaid; the CALL is the proof).
  const verified = await verifyTransaction(init.reference);
  console.log(
    'SPIKE verify_ok=true status=' + verified.paymentStatus + ' currency=' + verified.currency,
  );

  console.log('SPIKE COMPLETE — rail proven');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.log('SPIKE FAILED: ' + (err as Error).message.slice(0, 300));
    process.exit(1);
  });
