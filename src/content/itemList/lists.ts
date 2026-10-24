// What differs between the wishlist and the collection tab: where Bandcamp keeps each, what we
// call it, and which sync step and count say its list is complete (decisions §14, §24).

import { FAN_PAGE_DOM } from '../../bandcamp';
import type { ListSource } from '../../shared/itemList';
import type { SyncStatus, SyncStep } from '../../shared/sync';

export interface ListConfig {
  source: ListSource;
  /** Bandcamp's tab and the holder of its items, as selectors (FAN_PAGE_DOM). */
  grid: string;
  items: string;
  /** Bandcamp's search box for the list, hidden while ours stands in. */
  search: string;
  /** The word the list goes by in our text. */
  noun: string;
  /** The sync step that fetches this list. */
  step: SyncStep;
  /** How many items the sync has saved so far; a change reloads the list. */
  countOf: (status: Extract<SyncStatus, { state: 'known' }>) => number;
  /** Names the filter bar, the grid and the page's own tag for this list. */
  label: string;
}

export const WISHLIST: ListConfig = {
  source: 'wishlist',
  grid: FAN_PAGE_DOM.wishlistGrid,
  items: FAN_PAGE_DOM.wishlistItems,
  search: FAN_PAGE_DOM.wishlistSearch,
  noun: 'wishlist',
  step: 'wishlist',
  countOf: (status) => status.wishlisted,
  label: 'your wishlist',
};

export const COLLECTION: ListConfig = {
  source: 'collection',
  grid: FAN_PAGE_DOM.collectionGrid,
  items: FAN_PAGE_DOM.collectionItems,
  search: FAN_PAGE_DOM.collectionSearch,
  noun: 'collection',
  step: 'collection',
  countOf: (status) => status.owned,
  label: 'your collection',
};
