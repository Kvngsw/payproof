import crypto from 'crypto';
import bcrypt from 'bcrypt';
import db from './db';
import { logger } from './logger';

const SEED_PASSWORD = 'SeedPassword123!'; // demo logins; production seeds use generated secrets

const SELLERS = [
  {
    name: 'Adaeze Okafor',
    businessName: 'Ada Kicks',
    email: 'ada@payproof.ng',
    phone: '+2348012345678',
    products: [
      { name: 'Air Runner Sneakers', priceKobo: 4500000, dispatchFeeKobo: 250000, deliveryDays: 3, description: 'Premium running sneakers with responsive cushioning.', stockQuantity: 12 },
      { name: 'Street Court Classics', priceKobo: 3200000, dispatchFeeKobo: 200000, deliveryDays: 2, description: 'Timeless court-style sneakers for everyday wear.', stockQuantity: 8 },
      { name: 'Trail Blazer Boots', priceKobo: 5800000, dispatchFeeKobo: 300000, deliveryDays: 4, description: 'Rugged trail boots built for Nigerian terrain.', stockQuantity: 5 },
      { name: 'Flex Knit Runners', priceKobo: 2750000, dispatchFeeKobo: 200000, deliveryDays: 2, description: 'Lightweight knit runners, breathable and fast.', stockQuantity: 0 },
      { name: 'Heritage Leather Loafers', priceKobo: 6100000, dispatchFeeKobo: 250000, deliveryDays: 5, description: 'Hand-finished leather loafers for formal occasions.', stockQuantity: 3 },
    ],
  },
  {
    name: 'Emeka Nwosu',
    businessName: 'Emeka Electronics',
    email: 'emeka@payproof.ng',
    phone: '+2348098765432',
    products: [
      { name: 'Volt Power Bank 20K', priceKobo: 1850000, dispatchFeeKobo: 150000, deliveryDays: 2, description: '20000mAh fast-charging power bank with dual USB-C.', stockQuantity: 20 },
      { name: 'Echo Buds Pro', priceKobo: 2400000, dispatchFeeKobo: 150000, deliveryDays: 2, description: 'Noise-cancelling wireless earbuds, 36h battery.', stockQuantity: 15 },
      { name: 'Solar Desk Lamp', priceKobo: 950000, dispatchFeeKobo: 120000, deliveryDays: 3, description: 'Solar-powered desk lamp with 3 brightness modes.', stockQuantity: 5 },
      { name: 'Thunder Extension Reel', priceKobo: 1300000, dispatchFeeKobo: 150000, deliveryDays: 2, description: 'Heavy-duty 4-socket extension reel with surge guard.', stockQuantity: 9 },
      { name: 'Smart Home Mini Hub', priceKobo: 3600000, dispatchFeeKobo: 200000, deliveryDays: 4, description: 'Voice-controlled smart home hub, works offline.', stockQuantity: 6 },
    ],
  },
];

async function main() {
  logger.info('Seed starting — wiping prior seed rows');

  const emails = SELLERS.map((s) => s.email);
  const oldSellers = await db.seller.findMany({ where: { email: { in: emails } }, select: { id: true } });
  const oldIds = oldSellers.map((s) => s.id);
  if (oldIds.length > 0) {
    await db.orderEvent.deleteMany({ where: { order: { sellerId: { in: oldIds } } } });
    await db.payout.deleteMany({ where: { order: { sellerId: { in: oldIds } } } });
    await db.payment.deleteMany({ where: { order: { sellerId: { in: oldIds } } } });
    await db.order.deleteMany({ where: { sellerId: { in: oldIds } } });
    await db.invoice.deleteMany({ where: { sellerId: { in: oldIds } } });
    await db.product.deleteMany({ where: { sellerId: { in: oldIds } } });
    await db.seller.deleteMany({ where: { id: { in: oldIds } } });
  }

  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 12);

  const buyer = await db.buyer.upsert({
    where: { email: 'tobi@payproof.ng' },
    update: {},
    create: { email: 'tobi@payproof.ng' },
  });

  for (const s of SELLERS) {
    const seller = await db.seller.create({
      data: {
        name: s.name,
        businessName: s.businessName,
        email: s.email,
        passwordHash,
        phone: s.phone,
        bvnHash: crypto.createHash('sha256').update('22222222222').digest('hex'),
        settlementBank: '058',
        settlementNumber: '0123456789',
        settlementName: s.name.toUpperCase(),
        reservedAccountNumber: '9900001234',
        reservedBankName: 'Sandbox Bank',
        reservedAccountName: `PayProof — ${s.name}`,
      },
    });

    const products = [];
    for (const p of s.products) {
      products.push(
        await db.product.create({
          data: {
            sellerId: seller.id,
            name: p.name,
            priceKobo: p.priceKobo,
            dispatchFeeKobo: p.dispatchFeeKobo,
            deliveryDays: p.deliveryDays,
            description: p.description,
            stockQuantity: p.stockQuantity,
          },
        }),
      );
    }

    const history: Array<'Completed' | 'Cancelled'> = [ // 70/30 split: non-trivial reputation, honest mix
      'Completed', 'Completed', 'Completed', 'Completed', 'Completed', 'Completed',
      'Cancelled', 'Cancelled', 'Cancelled',
    ];

    let i = 0;
    for (const status of history) {
      const product = products[i % products.length];
      const totalKobo = product.priceKobo + product.dispatchFeeKobo;
      const createdAt = new Date(Date.now() - (i + 1) * 86400000 * 3);

      const order = await db.order.create({
        data: {
          sellerId: seller.id,
          buyerId: buyer.id,
          productId: product.id,
          productPriceKobo: product.priceKobo,
          dispatchFeeKobo: product.dispatchFeeKobo,
          totalKobo,
          deliveryDays: product.deliveryDays,
          status,
          deliveryAddress: '14 Allen Avenue, Ikeja, Lagos',
          buyerPhone: '+2348077777777',
          trackingStatus: status === 'Completed' ? 'Delivered' : null,
          trackingSource: 'manual',
          fraudFlag: { triggered: false, state: 'clear', label: 'Rule-based' },
          createdAt,
          updatedAt: createdAt,
        },
      });

      const chain =
        status === 'Completed'
          ? (['PendingPayment', 'Paid', 'AwaitingShipment', 'Shipped', 'Delivered', 'Completed'] as const)
          : (['PendingPayment', 'Cancelled'] as const);

      for (let s2 = 1; s2 < chain.length; s2++) {
        await db.orderEvent.create({
          data: {
            orderId: order.id,
            fromStatus: chain[s2 - 1],
            toStatus: chain[s2],
            actor: s2 <= 2 ? 'system' : s2 === chain.length - 1 && status === 'Cancelled' ? 'buyer' : 'seller',
            note: 'seeded history',
            createdAt,
          },
        });
      }

      i++;
    }

    logger.info('Seller seeded', { sellerId: seller.id, email: s.email, products: products.length, history: history.length });
  }

  logger.info(`Seed complete. Login passwords: ${SEED_PASSWORD}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    logger.error('Seed failed', { err });
    process.exit(1);
  });
