import { defineConfig } from 'vitest/config';

// Perf checks seed big databases, so they run apart from `pnpm test`: `pnpm perf`.
export default defineConfig({
  test: {
    include: ['tests/perf/**/*.perf.ts'],
    environment: 'node',
    setupFiles: ['tests/setup.ts'],
    testTimeout: 10 * 60 * 1000,
    hookTimeout: 10 * 60 * 1000,
  },
});
