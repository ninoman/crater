import { describe, expect, it } from 'vitest';
import type { BandRecord, ItemRecord } from './schema';
import {
  readItem,
  readOwnership,
  releaseUrlHost,
  shortHost,
  readFacts,
  readItemFields,
  storeItem,
  storeOwnership,
  withBandFacts,
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

describe('filter facts on items', () => {
  const facts = { year: 2021, nameYourPrice: false, physical: true };

  it('stores each known fact under a short name', () => {
    const { stored } = storeItem(record({ facts }), undefined);

    expect(stored).toMatchObject({ year: 2021, nyp: false, physical: true });
    expect(readItemFields(stored).facts).toEqual(facts);
  });

  it('leaves out facts that are not known, and the whole object when none is', () => {
    const { stored } = storeItem(
      record({ facts: { year: null, nameYourPrice: true, physical: null } }),
      undefined,
    );

    expect(stored).not.toHaveProperty('year');
    expect(stored).not.toHaveProperty('physical');
    expect(readFacts(stored)).toEqual({ year: null, nameYourPrice: true, physical: null });

    const bare = storeItem(record(), undefined).stored;
    expect(readFacts(bare)).toBeUndefined();
    expect(readItemFields(bare)).not.toHaveProperty('facts');
  });
});

describe('withBandFacts', () => {
  const band: BandRecord = { bandId: 7, hosts: ['artist'] };

  it('adds a genre and a location', () => {
    expect(withBandFacts(band, { genre: 10, location: 'Leipzig, Germany' })).toEqual({
      ...band,
      genre: 10,
      location: 'Leipzig, Germany',
    });
  });

  it('never erases a fact with a missing one, and says when nothing changed', () => {
    const known = { ...band, genre: 10, location: 'Leipzig, Germany' };

    expect(withBandFacts(known, { genre: null, location: null })).toBeUndefined();
    expect(withBandFacts(known, { genre: 10, location: 'Leipzig, Germany' })).toBeUndefined();
    expect(withBandFacts(known, { genre: 3, location: null })).toEqual({ ...known, genre: 3 });
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
