// How the wishlist and collection tabs order their items (decisions §22). Pure, so the order is
// the same for the cards, the Friday shortlist and the CSV export.

import type { ListedItem, ListSource } from './itemList';

export type SortKey = 'added' | 'artist' | 'label' | 'price' | 'crateMates' | 'buyNext';
export type SortDirection = 'asc' | 'desc';
export interface SortSpec {
  key: SortKey;
  direction: SortDirection;
}

/** The keys each list offers, in the order the sort menu shows them. */
export const SORT_KEYS: Readonly<Record<ListSource, readonly SortKey[]>> = {
  wishlist: ['added', 'artist', 'label', 'price', 'crateMates', 'buyNext'],
  collection: ['added', 'artist', 'label'],
};

/** What the menu calls each key; the date key says what the list's date means. */
export function sortLabel(key: SortKey, source: ListSource): string {
  switch (key) {
    case 'added':
      return source === 'wishlist' ? 'Date added' : 'Date purchased';
    case 'artist':
      return 'Artist';
    case 'label':
      return 'Label';
    case 'price':
      return 'Price';
    case 'crateMates':
      return 'Crate mates who own it';
    case 'buyNext':
      return 'Buy next';
  }
}

/** Newest, most-owned and best-rated first; names and prices run low to high. */
export function defaultDirection(key: SortKey): SortDirection {
  return key === 'artist' || key === 'label' || key === 'price' ? 'asc' : 'desc';
}

export const DEFAULT_SORT: SortSpec = { key: 'added', direction: 'desc' };

/** A saved spec that this list can still show, else the default. */
export function validSort(spec: SortSpec, source: ListSource): SortSpec {
  return SORT_KEYS[source].includes(spec.key) ? spec : DEFAULT_SORT;
}

const collator = new Intl.Collator('en', { sensitivity: 'base', numeric: true });

/** Whether an item has nothing to sort by under this key. Those go last in either direction. */
function missing(item: ListedItem, key: SortKey): boolean {
  switch (key) {
    case 'added':
      return item.addedAt === null;
    case 'artist':
      return item.artist.trim() === '';
    case 'label':
      return item.label === null || item.label.trim() === '';
    case 'price':
      return item.price === null;
    case 'crateMates':
    case 'buyNext':
      return false;
  }
}

/** Ascending order for the key; only called when neither item is missing. */
function compare(a: ListedItem, b: ListedItem, key: SortKey): number {
  switch (key) {
    case 'added':
      return (a.addedAt ?? 0) - (b.addedAt ?? 0);
    case 'artist':
      return collator.compare(a.artist, b.artist);
    case 'label':
      return collator.compare(a.label ?? '', b.label ?? '');
    case 'price':
      // Amounts in different currencies can't be compared, so a currency's items stay together.
      return (
        collator.compare(a.price?.currency ?? '', b.price?.currency ?? '') ||
        (a.price?.amount ?? 0) - (b.price?.amount ?? 0)
      );
    case 'crateMates':
      return a.crateMateOwners - b.crateMateOwners || a.crateMateScore - b.crateMateScore;
    case 'buyNext':
      // Your rating decides; crate mates break ties. An unrated release ranks below a 1.
      return (
        (a.note?.rating ?? 0) - (b.note?.rating ?? 0) ||
        compare(a, b, 'crateMates') ||
        (a.addedAt ?? 0) - (b.addedAt ?? 0)
      );
  }
}

/** The items ordered by `spec`. A tie keeps the order it came in. */
export function sortItems(items: readonly ListedItem[], spec: SortSpec): ListedItem[] {
  const sign = spec.direction === 'asc' ? 1 : -1;
  return [...items].sort((a, b) => {
    const gone = missing(a, spec.key);
    if (gone !== missing(b, spec.key)) return gone ? 1 : -1;
    return gone ? 0 : sign * compare(a, b, spec.key);
  });
}
