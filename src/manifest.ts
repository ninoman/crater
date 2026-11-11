import { defineManifest } from '@crxjs/vite-plugin';
import pkg from '../package.json' with { type: 'json' };
import { BANDCAMP_MATCHES } from './shared/bandcampHosts';

export type Browser = 'chrome' | 'firefox';

const WORKER = 'src/background/index.ts';

// Firefox MV3 has no extension service workers, only event pages (decisions §26).
// 142 is the first version (desktop and Android) that reads data_collection_permissions,
// which AMO requires on new listings.
const firefox = {
  background: { scripts: [WORKER] },
  browser_specific_settings: {
    gecko: {
      // Permanent once listed on AMO.
      id: 'crater@ninoman',
      strict_min_version: '142.0',
      data_collection_permissions: { required: ['none' as const] },
    },
  },
};

const chrome = {
  background: { service_worker: WORKER, type: 'module' },
};

export const manifestFor = (browser: Browser) =>
  defineManifest({
    manifest_version: 3,
    name: 'Crater – Music discovery for Bandcamp',
    description: 'Purchase-based discovery for Bandcamp. Everything stays in your browser.',
    version: pkg.version,
    icons: {
      16: 'icons/icon-16.png',
      32: 'icons/icon-32.png',
      48: 'icons/icon-48.png',
      128: 'icons/icon-128.png',
    },
    // declarativeNetRequest sets the Origin Bandcamp requires on wishlist POSTs (decisions §6).
    // The WithHostAccess variant adds no install warning beyond the Bandcamp host access.
    permissions: ['storage', 'alarms', 'declarativeNetRequestWithHostAccess'],
    // Asked for from the popup when you turn on notifications for your follows (decisions §23).
    optional_permissions: ['notifications'],
    host_permissions: BANDCAMP_MATCHES,
    content_scripts: [
      {
        matches: BANDCAMP_MATCHES,
        js: ['src/content/index.tsx'],
        run_at: 'document_idle',
      },
    ],
    action: {
      default_popup: 'src/popup/index.html',
      default_title: 'Crater',
      default_icon: {
        16: 'icons/icon-16.png',
        32: 'icons/icon-32.png',
      },
    },
    ...(browser === 'firefox' ? firefox : chrome),
  });
