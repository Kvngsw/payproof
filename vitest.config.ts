/**
 * vitest.config.ts — loads .env.local before test modules import lib/*.
 *
 * WHY: lib/env.ts validates at import time (fail-fast). Next.js auto-loads
 * .env.local at runtime, but vitest does not — so we load it here. In CI
 * there is no .env.local; dotenv silently skips and the workflow's dummy
 * env vars (see .github/workflows/ci.yml) satisfy validation instead.
 */

import { config } from 'dotenv';
import { defineConfig } from 'vitest/config';

config({ path: '.env.local' });

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
