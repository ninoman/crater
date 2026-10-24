import { defineManifest } from '@crxjs/vite-plugin';
import pkg from '../package.json' with { type: 'json' };

// Custom-domain Bandcamp sites (e.g. music.koansound.com) are out of scope for the MVP:
// matching them needs optional host permissions requested per domain.
const BANDCAMP_MATCHES = ['https://bandcamp.com/*', 'https://*.bandcamp.com/*'];

export default defineManifest({
  manifest_version: 3,
  name: 'Dighead – Music discovery for Bandcamp',
  description: 'Purchase-based discovery for Bandcamp. Everything stays in your browser.',
  version: pkg.version,
  icons: {
    16: 'icons/icon-16.png',
    32: 'icons/icon-32.png',
    48: 'icons/icon-48.png',
    128: 'icons/icon-128.png',
  },
  permissions: ['storage', 'alarms'],
  // Asked for from the popup when you turn on notifications for your follows (decisions §22).
  optional_permissions: ['notifications'],
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
    default_icon: {
      16: 'icons/icon-16.png',
      32: 'icons/icon-32.png',
    },
  },
});
