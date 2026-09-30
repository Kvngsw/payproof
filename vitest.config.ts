import { config } from 'dotenv';
import { defineConfig } from 'vitest/config';
import path from 'path';

config({ path: '.env.local' });

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
