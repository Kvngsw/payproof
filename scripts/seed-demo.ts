import fs from "node:fs";
import { ensureCollectionFiles, db, collectionFile } from "../lib/mock/store";
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
console.log("mock-data/ ready (additive — other records untouched):");
for (const name of names) {
  const rows = JSON.parse(fs.readFileSync(collectionFile(name), "utf-8"));
  console.log(`  ${name}.json: ${rows.length} rows`);
}
console.log(
  `  demo seller: ${DEMO_SEEDED_EMAIL} / demo1234 (orders seeded on first run only)`,
);
