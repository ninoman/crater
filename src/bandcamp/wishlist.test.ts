import { describe, expect, it, vi } from 'vitest';
import { fixtureJson, fixtureText } from '../../tests/fixtures';
import type { FetchJson } from './collection';
import { BandcampApiError } from './errors';
import { parseReleasePage, type FetchText } from './release';
import type { BandcampRequest } from './requests';
import { parseWishlistPage, setWishlisted } from './wishlist';

const ALBUM = fixtureText('album-page.html');
const ALBUM_URL = 'https://floatingpoints.bandcamp.com/album/promises';
const album = parseReleasePage(ALBUM).item;
const CRUMBS = {
  collect_item_cb: '|collect_item_cb|1794393127|ADD',
  uncollect_item_cb: '|uncollect_item_cb|1794393127|REMOVE',
  logout: '|logout|1794393127|OTHER',
};

/** The album page as a signed-in fan gets it: with crumbs. */
const SIGNED_IN = ALBUM.replace(
  /data-crumbs="[^"]*"/,
  `data-crumbs="${JSON.stringify(CRUMBS).replaceAll('"', '&quot;')}"`,
);

function fetchers(page: string, answer: unknown) {
  return {
    fetchText: vi.fn<FetchText>(async () => page),
    fetchJson: vi.fn<FetchJson>(async () => answer),
  };
}

const sent = (fetchJson: ReturnType<typeof fetchers>['fetchJson']) =>
  fetchJson.mock.calls[0]?.[0] as BandcampRequest;

describe('parseWishlistPage', () => {
  it('has no crumbs on a logged-out page', () => {
    expect(parseWishlistPage(ALBUM)).toEqual({ bandId: album.bandId, crumbs: {} });
  });

  it('reads the selling account and the heart crumbs', () => {
    expect(parseWishlistPage(SIGNED_IN)).toEqual({
      bandId: album.bandId,
      crumbs: {
        collect_item_cb: CRUMBS.collect_item_cb,
        uncollect_item_cb: CRUMBS.uncollect_item_cb,
      },
    });
  });
});

describe('setWishlisted', () => {
  it('adds a release to your wishlist with the page crumb, on bandcamp.com', async () => {
    const f = fetchers(SIGNED_IN, { ok: true });

    const result = await setWishlisted(f, ALBUM_URL, {
      fanId: 7,
      itemKey: album.itemKey,
      wishlisted: true,
    });

    expect(result).toEqual({ status: 'done' });
    expect(f.fetchText.mock.calls[0]?.[0].init.credentials).toBe('include');
    const request = sent(f.fetchJson);
    expect(request.url).toBe('https://bandcamp.com/collect_item_cb');
    expect(request.init.headers).toMatchObject({ 'X-Requested-With': 'XMLHttpRequest' });
    expect(Object.fromEntries(new URLSearchParams(String(request.init.body)))).toEqual({
      fan_id: '7',
      item_id: album.itemKey.slice(1),
      item_type: 'album',
      band_id: String(album.bandId),
      crumb: CRUMBS.collect_item_cb,
    });
  });

  it('takes a track of the release off your wishlist', async () => {
    const f = fetchers(SIGNED_IN, { ok: true });

    await setWishlisted(f, ALBUM_URL, { fanId: 7, itemKey: 't123', wishlisted: false });

    const request = sent(f.fetchJson);
    expect(request.url).toBe('https://bandcamp.com/uncollect_item_cb');
    const fields = new URLSearchParams(String(request.init.body));
    expect([fields.get('item_type'), fields.get('item_id'), fields.get('crumb')]).toEqual([
      'track',
      '123',
      CRUMBS.uncollect_item_cb,
    ]);
  });

  it('answers signed-out, and sends nothing, without a crumb', async () => {
    const f = fetchers(ALBUM, null);

    const result = await setWishlisted(f, ALBUM_URL, {
      fanId: 7,
      itemKey: album.itemKey,
      wishlisted: true,
    });

    expect(result).toEqual({ status: 'signed-out' });
    expect(f.fetchJson).not.toHaveBeenCalled();
  });

  it('throws when Bandcamp refuses the change', async () => {
    const f = fetchers(SIGNED_IN, fixtureJson('collect_item_cb-base-domain.json'));

    await expect(
      setWishlisted(f, ALBUM_URL, { fanId: 7, itemKey: album.itemKey, wishlisted: true }),
    ).rejects.toBeInstanceOf(BandcampApiError);
  });
});
