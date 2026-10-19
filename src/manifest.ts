import { defineManifest } from '@crxjs/vite-plugin';
import pkg from '../package.json' with { type: 'json' };

// Custom-domain Bandcamp sites (e.g. music.koansound.com) are out of scope for the MVP:
// matching them needs optional host permissions requested per domain.
const BANDCAMP_MATCHES = ['https://bandcamp.com/*', 'https://*.bandcamp.com/*'];

export default defineManifest({
  manifest_version: 3,
  name: 'Dighead',
  description: 'Purchase-based discovery for Bandcamp. Everything stays in your browser.',
  version: pkg.version,
  permissions: ['storage', 'alarms'],
  host_permissions: BANDCAMP_MATCHES,
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },
  content_scripts: [
    {
      matches: BANDCAMP_MATCHES,
      js: ['src/content/index.tsx'],
      run_at: 'document_idle',
    },
  ],
  action: {
    default_popup: 'src/popup/index.html',
    default_title: 'Dighead',
  },
});
