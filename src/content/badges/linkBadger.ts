// Finds new release links, looks them up in one batch and hands back the ones worth a badge.

import { findReleaseLinks } from '../../bandcamp';
import type { PageBadge, ReleaseRef } from '../../shared/pageBadges';
import { type BadgeText, badgeText } from './badgeText';

export interface LinkBadgerOptions {
  root: ParentNode;
  pageUrl: string;
  /** One worker round trip for the whole batch. */
  lookup: (links: ReleaseRef[]) => Promise<(PageBadge | null)[]>;
  place: (anchor: HTMLAnchorElement, text: BadgeText) => void;
}

/**
 * Returns a scan to run on load and whenever the page grows. Each run only looks at links it
 * hasn't seen, and only asks about releases it hasn't asked about before.
 */
export function createLinkBadger({ root, pageUrl, lookup, place }: LinkBadgerOptions) {
  const seen = new WeakSet<Element>();
  const known = new Map<string, PageBadge | null>();

  return async function scan(): Promise<void> {
    const links = findReleaseLinks(root, pageUrl, seen);
    const keyOf = (link: ReleaseRef) => link.itemKey ?? link.url;
    const asking = new Map<string, ReleaseRef>();
    for (const link of links) {
      const key = keyOf(link);
      if (!known.has(key)) asking.set(key, { url: link.url, itemKey: link.itemKey });
    }
    if (asking.size > 0) {
      const answers = await lookup([...asking.values()]);
      [...asking.keys()].forEach((key, i) => {
        known.set(key, answers[i] ?? null);
      });
    }
    for (const link of links) {
      const badge = known.get(keyOf(link));
      const text = badge && badgeText(badge);
      if (text) place(link.anchor, text);
    }
  };
}
