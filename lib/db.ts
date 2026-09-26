/**
 * lib/db.ts — Prisma + PostgreSQL singleton with connection pooling.
 *
 * WHY (connection pooling): Opening a new DB connection per request would
 * collapse under load. The pool keeps max=20 connections warm and reuses
 * them across requests. PgBouncer (provided by Neon/Render) adds another
 * layer of pooling at the network level.
 *
 * WHY (graceful shutdown): Cutting DB connections mid-transaction corrupts
 * data. On SIGTERM we drain the pool before the process exits.
 *
 * WHY (singleton pattern): In Next.js development, hot-reload creates new
 * module instances on every change. We persist the Prisma client on
 * globalThis to avoid exhausting the connection pool during dev.
 *
 * Ported and upgraded from PayProof 1.0 lib/db.js:
 *   + pool.max = 20 (was default ~5)
 *   + idleTimeoutMillis = 30 000
 *   + SIGTERM graceful shutdown hook
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg }    from '@prisma/adapter-pg';
import pg              from 'pg';
import { logger }      from './logger';
import { env }         from './env';

const { Pool } = pg;

function createPrismaClient(): PrismaClient {
  // Least-privilege role at runtime; superuser URL retained for migrate/seed.
  // Validated at boot by lib/env.ts — crashes with a named variable if unset.
  const connectionString = env.APP_DATABASE_URL ?? env.DATABASE_URL;

  const pool = new Pool({
    connectionString,
    // WHY max=20: enough for high concurrency without saturating managed
    // Postgres (Neon/Render default limits are 25–100).
    max: 20,
    // Release idle connections after 30s so we don't hold slots open
    // during quiet periods.
    idleTimeoutMillis: 30_000,
    // Fail fast on connection issues rather than hanging indefinitely.
    connectionTimeoutMillis: 5_000,
  });

  const adapter = new PrismaPg(pool);

  const client = new PrismaClient({
    adapter,
    log: env.NODE_ENV === 'development'
      ? ['warn', 'error']
      : ['error'],
  });

  // WHY graceful shutdown: SIGTERM is sent by the platform (Render, Railway,
  // Vercel, Docker) before terminating the process. We drain the pool so
  // in-flight transactions complete before the connection is cut.
  if (typeof process !== 'undefined') {
    process.once('SIGTERM', async () => {
      logger.info('SIGTERM received — draining DB connections');
      await client.$disconnect();
      await pool.end();
      logger.info('DB pool drained. Goodbye.');
    });

    process.once('SIGINT', async () => {
      logger.info('SIGINT received — draining DB connections');
      await client.$disconnect();
      await pool.end();
    });
  }

  return client;
}

// Extend globalThis with our Prisma instance so hot-reload doesn't create
// a new client (and exhaust the connection pool) on every file save.
const globalForPrisma = globalThis as typeof globalThis & {
  __prisma?: PrismaClient;
};

const db: PrismaClient =
  globalForPrisma.__prisma ?? createPrismaClient();

if (env.NODE_ENV !== 'production') {
  globalForPrisma.__prisma = db;
}

export default db;
