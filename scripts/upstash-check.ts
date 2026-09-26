import { checkRateLimit } from '../lib/rate-limit';

const [, , mode, key] = process.argv;

if (mode === 'consume') {
  for (let i = 0; i < 3; i++) {
    const r = await checkRateLimit(key, 3, 60_000);
    console.log(`CONSUME ${i + 1} allowed=${r.allowed} remaining=${r.remaining}`);
  }
} else if (mode === 'probe') {
  const r = await checkRateLimit(key, 3, 60_000);
  console.log(`PROBE allowed=${r.allowed} remaining=${r.remaining} retryAfterMs=${r.retryAfterMs}`);
  if (r.allowed) {
    console.log('UPSTASH_FAIL: probe allowed, counters not shared (in-memory?)');
    process.exit(1);
  }
  console.log('UPSTASH_OK: cross-process budget enforced by Redis');
} else {
  throw new Error('Usage: upstash-check.ts <consume|probe> <key>');
}
process.exit(0);
