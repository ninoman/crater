import { describe, expect, it } from 'vitest';
import { fixtureJson } from '../../tests/fixtures';
import { parseCollectionPage, toCollectionItem } from './collection';
import { BandcampApiError, ParserError } from './errors';
import type { RawCollectionItem } from './schemas';

const rawTrack: RawCollectionItem = {
  item_type: 'track',
  tralbum_id: 111,
  tralbum_type: 't',
  album_id: 222,
  item_title: 'Tiles',
  band_id: 9,
  band_name: 'Artist',
  also_collected_count: 4,
  item_art_id: 5,
  item_url: 'https://artist.bandcamp.com/track/tiles',
  purchased: '19 Oct 2026 17:18:45 GMT',
  added: null,
};

describe('parseCollectionPage', () => {
  it('parses a collection page and its next token', () => {
    const page = parseCollectionPage(fixtureJson('collection_items-p1.json'));

    expect(page.items).toHaveLength(40);
    expect(page.moreAvailable).toBe(true);
    expect(page.lastToken).toBe('1782206456:2206491889:a::');
    for (const item of page.items) {
      expect(item.itemKey).toMatch(/^[at]\d+$/);
      expect(item.addedAt).toEqual(expect.any(Number));
    }
  });

  it('continues with the second page', () => {
    const page = parseCollectionPage(fixtureJson('collection_items-p2.json'));

    expect(page.items).toHaveLength(40);
    expect(page.lastToken).toBe('1773195462:2701887816:a::');
  });

  it('parses a wishlist, using the added date', () => {
    const page = parseCollectionPage(fixtureJson('wishlist_items.json'), 'wishlist_items');

    expect(page.items).toHaveLength(9);
    expect(page.moreAvailable).toBe(false);
    expect(page.items[0]?.addedAt).toBe(Date.parse('21 May 2026 16:58:19 GMT'));
  });

  it('returns an empty page for an unknown fan', () => {
    const page = parseCollectionPage(fixtureJson('collection_items-unknown-fan.json'));

    expect(page).toEqual({ items: [], moreAvailable: false, lastToken: null });
  });

  it('throws BandcampApiError for a bad token or a hidden wishlist', () => {
    expect(() => parseCollectionPage(fixtureJson('collection_items-bad-token.json'))).toThrow(
      BandcampApiError,
    );
    expect(() => parseCollectionPage(fixtureJson('wishlist_items-hidden.json'))).toThrow(
      BandcampApiError,
    );
  });

  it('throws ParserError when the shape changes', () => {
    expect(() => parseCollectionPage({ items: 'nope' })).toThrow(ParserError);
  });
});

describe('toCollectionItem', () => {
  it('links a track to its album', () => {
    expect(toCollectionItem(rawTrack)).toMatchObject({ itemKey: 't111', albumKey: 'a222' });
  });

  it('keeps a standalone single as its own item', () => {
    expect(toCollectionItem({ ...rawTrack, album_id: null })?.albumKey).toBeNull();
  });

  it('skips item kinds it does not track', () => {
    expect(toCollectionItem({ ...rawTrack, item_type: 'subscription' })).toBeNull();
  });
});
