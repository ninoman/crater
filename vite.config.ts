import { crx } from '@crxjs/vite-plugin';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import manifest from './src/manifest.ts';

export default defineConfig({
  plugins: [react(), crx({ manifest })],
  build: {
    target: 'chrome120',
  },
  test: {
    include: ['src/**/*.test.{ts,tsx}', 'tests/**/*.test.ts'],
    environment: 'node',
  },
});
