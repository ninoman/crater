import { describe, expect, it } from 'vitest';
import { fixtureJson } from '../../tests/fixtures';
import { collectionPages, parseCollectionPage, toCollectionItem } from './collection';
import type { BandcampRequest } from './requests';
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
    // The last item's token. The response's own last_token (1782206456:…) points at item 20.
    expect(page.nextToken).toBe('1773195462:2701887816:a::');
    for (const item of page.items) {
      expect(item.itemKey).toMatch(/^[at]\d+$/);
      expect(item.addedAt).toEqual(expect.any(Number));
    }
  });

  it('reads the label when the release is on one', () => {
    const [denali, castrovalva] = parseCollectionPage(
      fixtureJson('collection_items-p1.json'),
    ).items;

    expect(denali).toMatchObject({ artist: 'Denali', label: 'Jade Tree', labelId: 1638814209 });
    expect(castrovalva).toMatchObject({ label: null, labelId: null });
  });

  it('reads filter facts from the fixture rows', () => {
    const items = parseCollectionPage(fixtureJson('collection_items-p1.json')).items;
    const [denali] = items;

    // Denali: is_set_price false, no merch, genre 2 (alternative), band_location null logged out.
    expect(denali?.facts).toEqual({ year: null, nameYourPrice: true, physical: false });
    expect(denali?.band).toEqual({ genre: 2, location: null });
    // 4 of the 40 rows are fixed-price, 21 list merch and 5 of those are sold out.
    expect(items.filter((item) => item.facts?.nameYourPrice === false)).toHaveLength(4);
    expect(items.filter((item) => item.facts?.physical)).toHaveLength(16);
    // One row has no genre_id.
    expect(items.filter((item) => item.band?.genre === null)).toHaveLength(1);
  });

  it('reads a band location when a row has one', () => {
    const item = toCollectionItem({
      ...rawTrack,
      genre_id: 10,
      band_location: ' Leipzig, Germany ',
      is_set_price: true,
      merch_ids: [4, 5],
      merch_sold_out: true,
    });

    expect(item?.band).toEqual({ genre: 10, location: 'Leipzig, Germany' });
    expect(item?.facts).toEqual({ year: null, nameYourPrice: false, physical: false });
  });

  it('leaves facts null where a row says nothing', () => {
    expect(toCollectionItem(rawTrack)?.facts).toEqual({
      year: null,
      nameYourPrice: null,
      physical: false,
    });
    expect(toCollectionItem(rawTrack)?.band).toEqual({ genre: null, location: null });
  });

  it('continues with the second page', () => {
    const page = parseCollectionPage(fixtureJson('collection_items-p2.json'));

    expect(page.items).toHaveLength(40);
    expect(page.nextToken).toBe('1756342375:1256372863:a::');
  });

  it('parses a wishlist, using the added date', () => {
    const page = parseCollectionPage(fixtureJson('wishlist_items.json'), 'wishlist_items');

    expect(page.items).toHaveLength(9);
    expect(page.moreAvailable).toBe(false);
    expect(page.items[0]?.addedAt).toBe(Date.parse('21 May 2026 16:58:19 GMT'));
  });

  it('returns an empty page for an unknown fan', () => {
    const page = parseCollectionPage(fixtureJson('collection_items-unknown-fan.json'));

    expect(page).toEqual({ items: [], moreAvailable: false, nextToken: null });
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

  it('reads the price, its currency and whether it can be bought', () => {
    const items = parseCollectionPage(fixtureJson('wishlist_items.json'), 'wishlist_items').items;

    expect(items[0]?.price).toEqual({ amount: 15, currency: 'USD', purchasable: true });
    expect(items[1]?.price).toEqual({ amount: 16, currency: 'EUR', purchasable: true });
  });

  it('has no price when the row lacks one, and flags private or subscriber-only items', () => {
    expect(toCollectionItem(rawTrack)?.price).toBeNull();
    const priced = { ...rawTrack, price: 7, currency: 'GBP', is_purchasable: true };
    expect(toCollectionItem(priced)?.price).toEqual({
      amount: 7,
      currency: 'GBP',
      purchasable: true,
    });
    expect(toCollectionItem({ ...priced, is_private: true })?.price?.purchasable).toBe(false);
    expect(toCollectionItem({ ...priced, is_subscriber_only: true })?.price?.purchasable).toBe(
      false,
    );
    expect(toCollectionItem({ ...priced, is_purchasable: false })?.price?.purchasable).toBe(false);
  });

  it('skips item kinds it does not track', () => {
    expect(toCollectionItem({ ...rawTrack, item_type: 'subscription' })).toBeNull();
  });
});

describe('collectionPages', () => {
  function fakeFetch(responses: Record<string, unknown>) {
    const tokens: string[] = [];
    const fetchJson = async (request: BandcampRequest) => {
      const body = JSON.parse(request.init.body as string) as { older_than_token: string };
      tokens.push(body.older_than_token);
      return responses[body.older_than_token];
    };
    return { fetchJson, tokens };
  }

  it('follows the last item token from page to page', async () => {
    const { fetchJson, tokens } = fakeFetch({
      start: fixtureJson('collection_items-p1.json'),
      '1773195462:2701887816:a::': fixtureJson('collection_items-p2.json'),
    });
    const pages = collectionPages(fetchJson, 'collection', 1138719, 40, 'start');

    expect((await pages.next()).value?.items).toHaveLength(40);
    expect((await pages.next()).value?.items).toHaveLength(40);
    expect(tokens).toEqual(['start', '1773195462:2701887816:a::']);
  });

  it('stops when no more pages are available', async () => {
    const { fetchJson, tokens } = fakeFetch({ start: fixtureJson('wishlist_items.json') });
    const pages = [];
    for await (const page of collectionPages(fetchJson, 'wishlist', 1138719, 40, 'start')) {
      pages.push(page);
    }

    expect(pages).toHaveLength(1);
    expect(tokens).toEqual(['start']);
  });

  it('stops when the API repeats a token', async () => {
    const { fetchJson, tokens } = fakeFetch({
      '1773195462:2701887816:a::': fixtureJson('collection_items-p1.json'),
    });
    const pages = [];
    for await (const page of collectionPages(
      fetchJson,
      'collection',
      1,
      40,
      '1773195462:2701887816:a::',
    )) {
      pages.push(page);
    }

    expect(pages).toHaveLength(1);
    expect(tokens).toHaveLength(1);
  });

  it('surfaces API errors', async () => {
    const { fetchJson } = fakeFetch({ start: fixtureJson('wishlist_items-hidden.json') });

    await expect(collectionPages(fetchJson, 'wishlist', 1, 40, 'start').next()).rejects.toThrow(
      BandcampApiError,
    );
  });
});
