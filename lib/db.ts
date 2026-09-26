import { PrismaClient } from '@prisma/client';
import { PrismaPg }    from '@prisma/adapter-pg';
import pg              from 'pg';
import { logger }      from './logger';
import { env }         from './env';

const { Pool } = pg;

function createPrismaClient(): PrismaClient {

  const connectionString = env.APP_DATABASE_URL ?? env.DATABASE_URL; // least-privilege role at runtime; superuser only for migrate

  const pool = new Pool({
    connectionString,

    max: 20, // managed Postgres caps connections; 20 per instance avoids saturation

    idleTimeoutMillis: 30_000, // release idle slots in quiet periods

    connectionTimeoutMillis: 5_000, // fail fast, never hang a request on connect
  });

  const adapter = new PrismaPg(pool);

  const client = new PrismaClient({
    adapter,
    log: env.NODE_ENV === 'development'
      ? ['warn', 'error']
      : ['error'],
  });

  if (typeof process !== 'undefined') {
    process.once('SIGTERM', async () => { // drain pool so in-flight txns finish before kill
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

// Next.js hot-reload creates fresh modules per save; reuse one client or exhaust the pool
const globalForPrisma = globalThis as typeof globalThis & {
  __prisma?: PrismaClient;
};

const db: PrismaClient =
  globalForPrisma.__prisma ?? createPrismaClient();

if (env.NODE_ENV !== 'production') {
  globalForPrisma.__prisma = db;
}

export default db;
