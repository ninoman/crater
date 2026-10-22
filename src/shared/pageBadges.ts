// Badges next to release links on any Bandcamp page (decisions §15).

import type { ItemKey } from '../bandcamp';

/** A release link as the content script found it: by id when the page had one, else by URL. */
export interface ReleaseRef {
  url: string;
  itemKey: ItemKey | null;
}

/** What we know about a linked release. */
export interface PageBadge {
  owned: boolean;
  wishlisted: boolean;
  /** How many of your top twins own it. */
  twins: number;
  /** How many top twins were looked at (settings.topTwinsK, or fewer on a short board). */
  topTwins: number;
}
