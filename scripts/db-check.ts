/**
 * scripts/db-check.ts — Live DB verification (reputation + counts).
 * Run: npx tsx --env-file=.env.local scripts/db-check.ts
 */
import db from '../lib/db';
import { getReputation } from '../lib/reputation';

const ada = await db.seller.findUnique({ where: { email: 'ada@payproof.ng' } });
if (!ada) throw new Error('Seed seller ada@payproof.ng missing');
console.log('REPUTATION_ADA=' + JSON.stringify(await getReputation(ada.id)));

const emeka = await db.seller.findUnique({ where: { email: 'emeka@payproof.ng' } });
if (!emeka) throw new Error('Seed seller emeka@payproof.ng missing');
console.log('REPUTATION_EMEKA=' + JSON.stringify(await getReputation(emeka.id)));

const counts = await db.order.groupBy({ by: ['status'], _count: true });
console.log('ORDER_COUNTS=' + JSON.stringify(counts));

const products = await db.product.count();
console.log('PRODUCTS=' + products);

const payouts = await db.payout.findMany({ orderBy: { createdAt: 'desc' }, take: 6 });
console.log('PAYOUTS=' + JSON.stringify(payouts.map((p) => ({ to: p.recipientType, status: p.status, ref: p.transferRef }))));

process.exit(0);
