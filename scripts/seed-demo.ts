import { readCollection } from "../lib/mock/store";
import { ensureDemoData, DEMO_SEEDED_EMAIL } from "../lib/mock/seed";

ensureDemoData();

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
  `  demo seller: ${DEMO_SEEDED_EMAIL} / demo1234 (orders/products/invoices seeded in code)`,
);
