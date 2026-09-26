import { logger } from './logger';

export interface RateLimitResult {
  allowed:      boolean;
  remaining:    number;
  retryAfterMs: number;
}

const useUpstash =
  !!process.env.UPSTASH_REDIS_REST_URL &&
  !!process.env.UPSTASH_REDIS_REST_TOKEN;

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

const pruneTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of _memStore) {
    if (now >= bucket.resetAt) _memStore.delete(key);
  }
}, 10 * 60 * 1_000); // cap memory growth from dead buckets

pruneTimer.unref?.();

export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  if (useUpstash) {
    try {
      return await upstashCheck(key, limit, windowMs);
    } catch (err) {

      logger.error('rateLimit: Upstash failed, allowing request', {
        err: err instanceof Error ? err : new Error(String(err)),
        key,
      });
      return { allowed: true, remaining: limit, retryAfterMs: 0 }; // a Redis outage must never become an auth outage
    }
  }
  return checkMemory(key, limit, windowMs);
}

export function clientIp(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    '127.0.0.1'
  );
}
