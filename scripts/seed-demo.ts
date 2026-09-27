import { ensureCollectionFiles, db, readCollection } from "../lib/mock/store";
import {
  ensureDemoSellers,
  ensureOrdersForSeller,
  ensureProductsForSeller,
  DEMO_SEEDED_EMAIL,
} from "../lib/mock/seed";

ensureCollectionFiles();
ensureDemoSellers();

const demo = db.sellers.findByEmail(DEMO_SEEDED_EMAIL);
if (demo) {
  ensureOrdersForSeller(demo);
  ensureProductsForSeller(demo);
}

const names = [
  "sellers",
  "buyers",
  "otp_codes",
  "orders",
  "products",
  "invoices",
] as const;
console.log("mock-data ready (SQLite — additive, other records untouched):");
for (const name of names) {
  console.log(`  ${name}: ${readCollection(name).length} rows`);
}
console.log(
  `  demo seller: ${DEMO_SEEDED_EMAIL} / demo1234 (orders seeded on first run only)`,
);
