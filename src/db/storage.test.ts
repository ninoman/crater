import { describe, expect, it } from 'vitest';
import type { BandRecord, ItemRecord } from './schema';
import {
  readItem,
  readOwnership,
  releaseUrlHost,
  shortHost,
  storeItem,
  storeOwnership,
} from './storage';

function record(patch: Partial<ItemRecord> = {}): ItemRecord {
  return {
    itemKey: 'a1',
    albumKey: null,
    title: 'Title',
    artist: 'Artist',
    bandId: 7,
    label: null,
    labelId: null,
    url: 'https://artist.bandcamp.com/album/title',
    artId: null,
    tags: [],
    supporterCount: null,
    compilation: false,
    ...patch,
  };
}

/** Stores items one after another, as a repo write does, and reads them back. */
function roundTrip(items: ItemRecord[]) {
  let band: BandRecord | undefined;
  const stored = items.map((item) => {
    const result = storeItem(item, band);
    band = result.band ?? band;
    return result.stored;
  });
  return { stored, band, read: stored.map((row) => readItem(row, band)) };
}

describe('shortHost', () => {
  it('keeps a subdomain and every other host whole', () => {
    expect(shortHost('artist.bandcamp.com')).toBe('artist');
    expect(shortHost('music.label.com')).toBe('music.label.com');
    expect(shortHost('bandcamp.com')).toBe('bandcamp.com');
    expect(shortHost('a.b.bandcamp.com')).toBe('a.b.bandcamp.com');
  });

  it('reads a release link host, and nothing from other links', () => {
    expect(releaseUrlHost('https://artist.bandcamp.com/track/x')).toBe('artist');
    expect(releaseUrlHost('https://artist.bandcamp.com/music')).toBeNull();
  });
});

describe('storeItem', () => {
  it('stores a slug and leaves defaults out', () => {
    const { stored, band } = roundTrip([record()]);
    expect(stored).toEqual([
      { itemKey: 'a1', title: 'Title', artist: 'Artist', bandId: 7, slug: 'title' },
    ]);
    expect(band).toEqual({ bandId: 7, hosts: ['artist'] });
  });

  it('keeps every set field', () => {
    const full = record({
      itemKey: 't2',
      albumKey: 'a1',
      label: 'Label',
      labelId: 9,
      url: 'https://artist.bandcamp.com/track/song',
      artId: 3,
      tags: ['dub'],
      supporterCount: 12,
      compilation: true,
    });
    expect(roundTrip([full]).read).toEqual([full]);
  });

  it('names a host other than the band default on the item', () => {
    const items = [
      record(),
      record({ itemKey: 'a2', url: 'https://oldname.bandcamp.com/album/two' }),
      record({ itemKey: 'a3', url: 'https://music.label.com/album/three' }),
    ];
    const { stored, band, read } = roundTrip(items);
    expect(stored.map((row) => row.host)).toEqual([undefined, 'oldname', 'music.label.com']);
    expect(band?.hosts).toEqual(['artist', 'oldname', 'music.label.com']);
    expect(read).toEqual(items);
  });

  it('keeps a URL that does not split as it is', () => {
    const odd = [
      record({ url: 'https://artist.bandcamp.com/track/wrong-kind' }),
      record({ itemKey: 'a2', url: 'https://artist.bandcamp.com/album/x?from=y' }),
    ];
    const { stored, read } = roundTrip(odd);
    expect(stored.map((row) => row.url)).toEqual(odd.map((item) => item.url));
    expect(read).toEqual(odd);
  });

  it('reads a row stored before v12 as it was', () => {
    const legacy = { ...record({ tags: ['x'] }), fetchedAt: 5 };
    expect(readItem(legacy, undefined)).toEqual(record({ tags: ['x'] }));
  });
});

describe('ownership rows', () => {
  const row = { fanId: 1, itemKey: 'a1', matchKey: 'a1', addedAt: null } as const;

  it('leaves out source for the collection only', () => {
    expect(storeOwnership({ ...row, source: 'collection' })).toEqual(row);
    expect(storeOwnership({ ...row, source: 'wishlist' })).toEqual({ ...row, source: 'wishlist' });
  });

  it('reads a row without source, or from before v12, as collection', () => {
    expect(readOwnership(row).source).toBe('collection');
    expect(readOwnership({ ...row, source: 'collection' }).source).toBe('collection');
    expect(readOwnership({ ...row, source: 'wishlist' }).source).toBe('wishlist');
  });
});
