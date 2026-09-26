/**
 * lib/rate-limit.ts — Rate limiting with dual backends.
 *
 * WHY: Without rate limiting, one script can destroy your server or spam
 * 10,000 people. One OTP request per email per 15 minutes. Ten login
 * attempts per IP per minute. No exceptions.
 *
 * Backend 1 — Upstash Redis: Required for production / serverless.
 *   The counter lives in Redis across all instances, not per-process memory.
 *
 * Backend 2 — In-memory Map: Local dev / single-process fallback.
 *   Resets on restart. DO NOT rely on in production serverless.
 *
 * Both backends expose the same surface: checkRateLimit / clientIp.
 * Route handlers never know which backend is active.
 *
 * Ported verbatim from PayProof 1.0 lib/rateLimit.js + TypeScript types.
 * Changed: prefix 'payproof-ratelimit' → 'pp2:' to isolate 2.0 counters.
 */

import { logger } from './logger';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RateLimitResult {
  allowed:      boolean;
  remaining:    number;
  retryAfterMs: number;
}

// ── Backend selection ─────────────────────────────────────────────────────────

const useUpstash =
  !!process.env.UPSTASH_REDIS_REST_URL &&
  !!process.env.UPSTASH_REDIS_REST_TOKEN;

// ── Upstash backend ───────────────────────────────────────────────────────────

// Lazy-loaded to avoid import errors when Upstash vars are not set.
let _redis: import('@upstash/redis').Redis | null = null;

async function getRedis(): Promise<import('@upstash/redis').Redis> {
  if (!_redis) {
    const { Redis } = await import('@upstash/redis');
    _redis = new Redis({
      url:   process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
  }
  return _redis;
}

const _limiterCache = new Map<string, import('@upstash/ratelimit').Ratelimit>();

async function upstashCheck(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  const cacheKey = `${limit}:${windowMs}`;
  let limiter = _limiterCache.get(cacheKey);

  if (!limiter) {
    const { Ratelimit } = await import('@upstash/ratelimit');
    limiter = new Ratelimit({
      redis:     await getRedis(),
      limiter:   Ratelimit.slidingWindow(limit, `${windowMs} ms`),
      analytics: false,
      prefix:    'pp2:',
    });
    _limiterCache.set(cacheKey, limiter);
  }

  const res = await limiter.limit(key);
  return {
    allowed:      res.success,
    remaining:    res.remaining,
    retryAfterMs: Math.max(0, res.reset - Date.now()),
  };
}

// ── In-memory backend ─────────────────────────────────────────────────────────

interface Bucket { count: number; resetAt: number }
const _memStore = new Map<string, Bucket>();

function checkMemory(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  let bucket = _memStore.get(key);

  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + windowMs };
    _memStore.set(key, bucket);
  }

  bucket.count += 1;
  const allowed      = bucket.count <= limit;
  const remaining    = Math.max(0, limit - bucket.count);
  const retryAfterMs = bucket.resetAt - now;

  return { allowed, remaining, retryAfterMs };
}

// Prune expired buckets every 10 minutes to prevent unbounded memory growth.
const pruneTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of _memStore) {
    if (now >= bucket.resetAt) _memStore.delete(key);
  }
}, 10 * 60 * 1_000);

// Allow Node to exit even if this timer is still pending.
pruneTimer.unref?.();

// ── Public surface ────────────────────────────────────────────────────────────

/**
 * Check whether `key` has exceeded `limit` requests in `windowMs` milliseconds.
 *
 * Fails open on Redis errors — a Redis outage must not turn into an auth outage.
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  if (useUpstash) {
    try {
      return await upstashCheck(key, limit, windowMs);
    } catch (err) {
      // Fail open — log and allow so Redis downtime ≠ site downtime.
      logger.error('rateLimit: Upstash failed, allowing request', {
        err: err instanceof Error ? err : new Error(String(err)),
        key,
      });
      return { allowed: true, remaining: limit, retryAfterMs: 0 };
    }
  }
  return checkMemory(key, limit, windowMs);
}

/**
 * Extract the real client IP from reverse-proxy headers.
 * x-forwarded-for may contain a comma-separated chain — we want the first.
 */
export function clientIp(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    '127.0.0.1'
  );
}
