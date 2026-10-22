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
  /** How many of your top crate mates own it. */
  crateMates: number;
  /** How many top crate mates were looked at (settings.topCrateMatesK, or fewer on a short board). */
  topCrateMates: number;
}
