// Shapes of your wishlist on the message bus, shared by the worker and the profile page.

import type { ItemKey } from '../bandcamp';

/** A release in your wishlist, with your tags on it (decisions §13). */
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
