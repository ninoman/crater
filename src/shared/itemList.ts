// Shapes of your wishlist and collection on the message bus, shared by the worker and the
// profile page (decisions §14, §24).

import type { ItemKey } from '../bandcamp';

/** The two lists the profile page takes over. */
export type ListSource = 'wishlist' | 'collection';

/** A release in your wishlist or collection, with what you added to it. */
export interface ListedItem {
  itemKey: ItemKey;
  title: string;
  artist: string;
  /** The label when the release is on one but sold from the artist's account, else null. */
  label: string | null;
  url: string;
  coverUrl: string | null;
  /** When you wishlisted or bought it; null when Bandcamp didn't say. */
  addedAt: number | null;
  tagIds: number[];
  /** Wishlist only: how many of your top crate mates own it. */
  crateMateOwners: number;
  /** You've heard it, or a track of it (decisions §22). */
  heard: boolean;
}

/** Whether two reads of the same item would render the same card. */
export function sameListedItem(a: ListedItem, b: ListedItem): boolean {
  return (
    a.itemKey === b.itemKey &&
    a.title === b.title &&
    a.artist === b.artist &&
    a.label === b.label &&
    a.url === b.url &&
    a.coverUrl === b.coverUrl &&
    a.addedAt === b.addedAt &&
    a.tagIds.length === b.tagIds.length &&
    a.tagIds.every((id, i) => id === b.tagIds[i]) &&
    a.crateMateOwners === b.crateMateOwners &&
    a.heard === b.heard
  );
}
