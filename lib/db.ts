import { PrismaClient } from '@prisma/client';
import { PrismaPg }    from '@prisma/adapter-pg';
import pg              from 'pg';
import { logger }      from './logger';
import { env }         from './env';

const { Pool } = pg;

export class RetryPool extends Pool {
  query<T extends pg.Submittable>(queryStream: T): T;
  query<R extends unknown[] = unknown[], I extends unknown[] = unknown[]>(
    queryConfig: pg.QueryArrayConfig<I>,
    values?: pg.QueryConfigValues<I>,
  ): Promise<R>;
  query<R extends pg.QueryResultRow = pg.QueryResultRow, I extends unknown[] = unknown[]>(
    queryConfig: pg.QueryConfig<I>,
  ): Promise<pg.QueryResult<R>>;
  query<R extends pg.QueryResultRow = pg.QueryResultRow, I extends unknown[] = unknown[]>(
    queryTextOrConfig: string | pg.QueryConfig<I>,
    values?: pg.QueryConfigValues<I>,
  ): Promise<pg.QueryResult<R>>;
  query(first: unknown, second?: unknown): Promise<unknown> {
    if (typeof first !== 'string') {
      return (super.query as (...a: unknown[]) => Promise<unknown>)(first, second);
    }
    const run = (): Promise<unknown> =>
      (super.query as (t: string, v?: unknown) => Promise<unknown>)(first, second);
    return run().catch(async (err: unknown) => {
      const code = (err as { code?: string }).code;
      if (code !== 'ECONNREFUSED' && code !== 'ENOTFOUND') throw err;
      logger.warn('DB connection blip, retrying once', { code }); // refused pre-execution: replay cannot double-apply
      await new Promise((r) => setTimeout(r, 500));
      return run();
    });
  }
}

function createPrismaClient(): PrismaClient {

  const connectionString = env.APP_DATABASE_URL ?? env.DATABASE_URL; // least-privilege role at runtime; superuser only for migrate

  const pool = new RetryPool({
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
