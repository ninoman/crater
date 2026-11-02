import { crx } from '@crxjs/vite-plugin';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { type Browser, manifestFor } from './src/manifest.ts';

// BROWSER=firefox builds the Firefox variant into dist-firefox/.
const browser: Browser = process.env.BROWSER === 'firefox' ? 'firefox' : 'chrome';

export default defineConfig({
  plugins: [react(), crx({ manifest: manifestFor(browser), browser })],
  build: {
    target: ['chrome120', 'firefox142'],
    outDir: browser === 'firefox' ? 'dist-firefox' : 'dist',
  },
  test: {
    include: ['src/**/*.test.{ts,tsx}', 'tests/**/*.test.ts'],
    environment: 'node',
    setupFiles: ['tests/setup.ts'],
  },
});
