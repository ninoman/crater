// Badges next to release links anywhere on bandcamp.com, behind a setting (decisions §15).

import { createRoot } from 'react-dom/client';
import { sendMessage } from '../../shared/messages';
import { loadSettings } from '../../shared/settings';
import type { PageKind } from '../pageKind';
import { pageTheme } from '../shared/pageTheme';
import { createShadowSlot } from '../shared/shadowSlot';
import { BadgeLayer } from './BadgeLayer';
import { createBadgeStore } from './badgeStore';
import badgeCss from './PageBadges.css?inline';
import { createLinkBadger } from './linkBadger';

/** Infinite-scroll pages add cards in bursts: wait for a burst to settle before scanning. */
const SETTLE_MS = 300;
const HOST_TAG = 'crater-badge';

/** Starts badging if the setting is on. Never on your own profile, where everything is owned. */
export async function mountPageBadges(doc: Document, kind: PageKind): Promise<void> {
  if (kind === 'own-fan' || !(await loadSettings()).pageBadges) return;
  startPageBadges(doc, doc.location.href);
}

/** Badges the page now and again as it grows. Returns a function that stops watching. */
export function startPageBadges(doc: Document, pageUrl: string): () => void {
  const store = createBadgeStore();
  const theme = pageTheme(doc);
  // Detached: every badge is a portal, so the root itself never needs to be on the page.
  createRoot(doc.createElement('div')).render(<BadgeLayer store={store} />);

  const scan = createLinkBadger({
    root: doc,
    pageUrl,
    lookup: (links) => sendMessage('getPageBadges', { links }),
    place: (anchor, text) => {
      const { host, container } = createShadowSlot(doc, HOST_TAG, badgeCss);
      for (const [name, value] of Object.entries(theme ?? {})) host.style.setProperty(name, value);
      anchor.after(host);
      store.add(container, text);
    },
  });
  const run = () => {
    scan().catch((error: unknown) => console.warn('crater: page badges failed', error));
  };

  let timer: ReturnType<typeof setTimeout> | undefined;
  const observer = new MutationObserver((records) => {
    // Our own badges going in are mutations too; they never add links.
    if (!records.some((record) => [...record.addedNodes].some((node) => !isBadgeHost(node)))) {
      return;
    }
    clearTimeout(timer);
    timer = setTimeout(run, SETTLE_MS);
  });
  observer.observe(doc.body, { childList: true, subtree: true });
  run();
  return () => {
    observer.disconnect();
    clearTimeout(timer);
  };
}

function isBadgeHost(node: Node): boolean {
  return node instanceof Element && node.localName === HOST_TAG;
}
