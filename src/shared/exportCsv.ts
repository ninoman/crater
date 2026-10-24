// The CSV files the popup exports: your wishlist, your collection with your tags, notes and
// ratings, and a For you list (decisions §22). Pure; the popup fetches the data.

import { type CsvColumn, toCsv } from './csv';
import type { ForYouRow } from './forYou';
import type { Tag } from './following';
import type { ListedItem, ListSource } from './itemList';

export type CsvKind = 'wishlist' | 'collection' | 'for-you';

/** "dighead-wishlist-2026-10-24.csv" */
export function csvFilename(kind: CsvKind, date: Date): string {
  return `dighead-${kind}-${date.toISOString().slice(0, 10)}.csv`;
}

/** "2026-10-03", or empty when Bandcamp gave no date. Sorts as text and every spreadsheet reads it. */
function day(ms: number | null): string | null {
  return ms === null ? null : new Date(ms).toISOString().slice(0, 10);
}

function itemColumns(source: ListSource, tags: readonly Tag[]): CsvColumn<ListedItem>[] {
  const names = new Map(tags.map((tag) => [tag.id, tag.name]));
  const common: CsvColumn<ListedItem>[] = [
    { header: 'Artist', cell: (item) => item.artist },
    { header: 'Title', cell: (item) => item.title },
    { header: 'Label', cell: (item) => item.label },
    { header: 'URL', cell: (item) => item.url },
    { header: source === 'wishlist' ? 'Added' : 'Purchased', cell: (item) => day(item.addedAt) },
  ];
  const wishlistOnly: CsvColumn<ListedItem>[] = [
    { header: 'Price', cell: (item) => item.price?.amount ?? null },
    { header: 'Currency', cell: (item) => item.price?.currency ?? null },
    {
      header: 'For sale',
      cell: (item) => (item.price === null ? null : item.price.purchasable ? 'yes' : 'no'),
    },
    { header: 'Crate mates who own it', cell: (item) => item.crateMateOwners },
  ];
  const yours: CsvColumn<ListedItem>[] = [
    {
      header: 'Tags',
      cell: (item) =>
        item.tagIds
          .flatMap((id) => names.get(id) ?? [])
          .sort((a, b) => a.localeCompare(b))
          .join('; '),
    },
    { header: 'Rating', cell: (item) => item.note?.rating ?? null },
    { header: 'Note', cell: (item) => item.note?.text ?? null },
  ];
  return source === 'wishlist' ? [...common, ...wishlistOnly, ...yours] : [...common, ...yours];
}

/** Your wishlist or collection as CSV, in the order given, with the names of your tags. */
export function itemsCsv(
  source: ListSource,
  items: readonly ListedItem[],
  tags: readonly Tag[],
): string {
  return toCsv(itemColumns(source, tags), items);
}

const FOR_YOU_COLUMNS: CsvColumn<{ row: ForYouRow; rank: number }>[] = [
  { header: 'Rank', cell: ({ rank }) => rank },
  { header: 'Artist', cell: ({ row }) => row.artist },
  { header: 'Title', cell: ({ row }) => row.title },
  { header: 'Label', cell: ({ row }) => row.label },
  { header: 'URL', cell: ({ row }) => row.url },
  { header: 'Owned by your top crate mates', cell: ({ row }) => row.crateMates },
  { header: 'Owners on Bandcamp', cell: ({ row }) => row.supporters },
  { header: 'Best crate mate rank', cell: ({ row }) => row.bestCrateMateRank },
  { header: 'Newest purchase by a crate mate', cell: ({ row }) => day(row.lastBoughtAt) },
  { header: 'You follow', cell: ({ row }) => row.followed },
];

/** A For you list as CSV, ranked in the order given. */
export function forYouCsv(rows: readonly ForYouRow[]): string {
  return toCsv(
    FOR_YOU_COLUMNS,
    rows.map((row, i) => ({ row, rank: i + 1 })),
  );
}
