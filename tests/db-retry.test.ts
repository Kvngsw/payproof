import { describe, it, expect } from 'vitest';
import { RetryPool } from '../lib/db';

describe('RetryPool', () => {
  it('retries refused connections once, then surfaces the error', async () => {
    const pool = new RetryPool({
      connectionString: 'postgresql://127.0.0.1:1/none',
      connectionTimeoutMillis: 2000,
    });
    const start = Date.now();
    await expect(pool.query('SELECT 1')).rejects.toMatchObject({ code: 'ECONNREFUSED' });
    expect(Date.now() - start).toBeGreaterThanOrEqual(300); // single attempt would fail near-instantly; backoff proves the retry ran
    await pool.end();
  });
});
