/**
 * prisma.config.ts — Prisma 7 configuration.
 *
 * WHY: Prisma 7 removed `url` from the schema datasource block. Connection
 * URLs for migrate live here instead. The app runtime never uses this file —
 * `lib/db.ts` passes a `pg` Pool adapter directly to PrismaClient.
 *
 * Uses DIRECT_URL (non-pooled, port 5432) for migrations. PgBouncer in
 * transaction mode cannot run DDL reliably, so migrate must bypass it.
 */

import { config } from "dotenv";
import { defineConfig, env } from "prisma/config";

// Next.js convention is `.env.local`; Prisma only auto-loads `.env`.
config({ path: ".env.local" });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DIRECT_URL"),
  },
});
