// Shapes of your wishlist on the message bus, shared by the worker and the profile page.

import type { ItemKey } from '../bandcamp';

/** A release in your wishlist, with your tags on it (decisions §14). */
export interface WishlistItem {
  itemKey: ItemKey;
  title: string;
  artist: string;
  url: string;
  coverUrl: string | null;
  /** When you wishlisted it; null when Bandcamp didn't say. */
  addedAt: number | null;
  tagIds: number[];
}

/** Whether two reads of the same item would render the same card. */
export function sameWishlistItem(a: WishlistItem, b: WishlistItem): boolean {
  return (
    a.itemKey === b.itemKey &&
    a.title === b.title &&
    a.artist === b.artist &&
    a.url === b.url &&
    a.coverUrl === b.coverUrl &&
    a.addedAt === b.addedAt &&
    a.tagIds.length === b.tagIds.length &&
    a.tagIds.every((id, i) => id === b.tagIds[i])
  );
}
