import { verifyTransaction } from '../lib/monnify';

const ref = process.argv[2];
if (!ref) throw new Error('Usage: verify-check.ts <transactionReference>');

try {
  const v = await verifyTransaction(ref);
  console.log('VERIFY_OK ' + JSON.stringify({ status: v.paymentStatus, kobo: v.amountKobo, currency: v.currency }));
  process.exit(0);
} catch (err) {
  console.log('VERIFY_FAIL ' + (err as Error).message.slice(0, 500));
  process.exit(1);
}
