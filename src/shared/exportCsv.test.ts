import { describe, expect, it } from 'vitest';
import type { ForYouRow } from './forYou';
import type { ListedItem } from './itemList';
import { csvFilename, forYouCsv, itemsCsv } from './exportCsv';

const tags = [
  { id: 1, name: 'dub', nameKey: 'dub' },
  { id: 2, name: 'Ambient', nameKey: 'ambient' },
];

function item(over: Partial<ListedItem> = {}): ListedItem {
  return {
    itemKey: 'a1',
    title: 'Untrue',
    artist: 'Burial',
    label: 'Hyperdub',
    url: 'https://hyperdub.bandcamp.com/album/untrue',
    coverUrl: null,
    addedAt: Date.UTC(2026, 9, 3, 12),
    tagIds: [1, 2],
    note: { text: 'play at "dusk", loud', rating: 5 },
    price: { amount: 9.5, currency: 'GBP', purchasable: true },
    crateMateOwners: 3,
    crateMateScore: 7,
    heard: false,
    ...over,
  };
}

const lines = (csv: string) => csv.replace('﻿', '').trimEnd().split('\r\n');

describe('itemsCsv', () => {
  it('writes the wishlist with price, tags, rating and note', () => {
    const csv = itemsCsv('wishlist', [item()], tags);

    expect(lines(csv)).toEqual([
      'Artist,Title,Label,URL,Added,Price,Currency,For sale,Crate mates who own it,Tags,Rating,Note',
      'Burial,Untrue,Hyperdub,https://hyperdub.bandcamp.com/album/untrue,2026-10-03,9.5,GBP,yes,3,Ambient; dub,5,"play at ""dusk"", loud"',
    ]);
  });

  it('writes the collection without prices, dated by purchase', () => {
    const csv = itemsCsv('collection', [item()], tags);

    expect(lines(csv)[0]).toBe('Artist,Title,Label,URL,Purchased,Tags,Rating,Note');
    expect(lines(csv)[1]).toBe(
      'Burial,Untrue,Hyperdub,https://hyperdub.bandcamp.com/album/untrue,2026-10-03,Ambient; dub,5,"play at ""dusk"", loud"',
    );
  });

  it('leaves out what is missing and ignores tags that no longer exist', () => {
    const bare = item({
      label: null,
      addedAt: null,
      tagIds: [99],
      note: null,
      price: null,
      crateMateOwners: 0,
    });

    expect(lines(itemsCsv('wishlist', [bare], tags))[1]).toBe(
      'Burial,Untrue,,https://hyperdub.bandcamp.com/album/untrue,,,,,0,,,',
    );
  });

  it('marks an unavailable release', () => {
    const gone = item({ price: { amount: 5, currency: 'USD', purchasable: false } });
    expect(lines(itemsCsv('wishlist', [gone], tags))[1]).toContain(',5,USD,no,');
  });

  it('is just the header for an empty list', () => {
    expect(lines(itemsCsv('collection', [], tags))).toHaveLength(1);
  });

  it('defuses a title that looks like a formula', () => {
    expect(lines(itemsCsv('collection', [item({ title: '=cmd()' })], tags))[1]).toContain(
      "Burial,'=cmd(),",
    );
  });
});

describe('forYouCsv', () => {
  const row: ForYouRow = {
    matchKey: 'a5',
    title: 'Promises',
    artist: 'Floating Points',
    label: null,
    url: 'https://x.bandcamp.com/album/promises',
    coverUrl: null,
    crateMates: 4,
    heard: false,
    hide: { band: null, label: null },
    supporters: 120,
    bestCrateMateRank: 2,
    lastBoughtAt: Date.UTC(2026, 8, 30),
    followed: 'Floating Points',
  };

  it('ranks the picks in the order given', () => {
    const csv = forYouCsv([
      row,
      { ...row, title: 'Elaenia', bestCrateMateRank: null, lastBoughtAt: null, followed: null },
    ]);

    expect(lines(csv)).toEqual([
      'Rank,Artist,Title,Label,URL,Owned by your top crate mates,Owners on Bandcamp,Best crate mate rank,Newest purchase by a crate mate,You follow',
      '1,Floating Points,Promises,,https://x.bandcamp.com/album/promises,4,120,2,2026-09-30,Floating Points',
      '2,Floating Points,Elaenia,,https://x.bandcamp.com/album/promises,4,120,,,',
    ]);
  });
});

describe('csvFilename', () => {
  it('names the kind and the day', () => {
    expect(csvFilename('for-you', new Date('2026-10-24T09:00:00Z'))).toBe(
      'dighead-for-you-2026-10-24.csv',
    );
  });
});
