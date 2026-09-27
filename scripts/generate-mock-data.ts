// Regenerates lib/mock/data.json — the static mock dataset shipped with the
// build. Starts from an empty store, runs the demo seed, dumps every
// collection. Run from ANY cwd:
//
//   npx tsx scripts/generate-mock-data.ts
//
// WARNING: regenerating assigns fresh random IDs, which invalidates tokens
// issued by any deployed instance. Only run when you intend to reset the demo.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

process.env.MOCK_SEED_EMPTY = "1";

const { readCollection } = await import("../lib/mock/store");
const { ensureDemoData } = await import("../lib/mock/seed");

ensureDemoData();

const names = [
  "sellers",
  "buyers",
  "otp_codes",
  "orders",
  "products",
  "invoices",
] as const;

const data: Record<string, unknown[]> = {};
for (const name of names) data[name] = readCollection(name);

const out = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "lib",
  "mock",
  "data.json",
);
fs.writeFileSync(out, JSON.stringify(data, null, 2) + "\n");

console.log(`wrote ${out}`);
for (const name of names) console.log(`  ${name}: ${data[name].length} rows`);
