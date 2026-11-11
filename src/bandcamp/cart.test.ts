// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fixtureJson, fixtureText } from '../../tests/fixtures';
import { parseCart, readPageCart, setInCart } from './cart';
import type { FetchJson } from './collection';
import { BandcampApiError } from './errors';
import { parseReleasePage, type FetchText } from './release';
import type { BandcampRequest } from './requests';

/** Sets an attribute's JSON the way Bandcamp serializes it. */
function withAttribute(html: string, name: string, value: object): string {
  const escaped = JSON.stringify(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;');
  return html.replace(new RegExp(`data-${name}="[^"]*"`), `data-${name}="${escaped}"`);
}

const ALBUM = fixtureText('album-page.html');
const TRACK = fixtureText('track-page.html');
const album = parseReleasePage(ALBUM).item;
const ALBUM_URL = 'https://floatingpoints.bandcamp.com/album/promises';

const line = (id: number, itemType: string, itemId: number) => ({
  id,
  item_type: itemType,
  item_id: itemId,
});

function body(request: BandcampRequest): URLSearchParams {
  return new URLSearchParams(String(request.init.body));
}

function fetchers(pages: Record<string, string>, answers: unknown[]) {
  const fetchText = vi.fn<FetchText>(async ({ url }) => {
    const page = pages[url];
    if (page === undefined) throw new Error(`unexpected ${url}`);
    return page;
  });
  const fetchJson = vi.fn<FetchJson>(async () => answers.shift());
  return { fetchText, fetchJson };
}

const change = { fanId: 7, localId: () => '0.5' };

describe('parseCart', () => {
  it('reads an empty cart from a logged-out release page', () => {
    expect(parseCart(ALBUM)).toEqual({ syncNum: 1, items: [] });
  });

  it('reads album and track lines, and skips packages', () => {
    const html = withAttribute(ALBUM, 'cart', {
      sync_num: 4,
      items: [line(11, 'a', 100), line(12, 't', 200), line(13, 'p', 300)],
    });

    expect(parseCart(html)).toEqual({
      syncNum: 4,
      items: [
        { lineId: 11, itemKey: 'a100' },
        { lineId: 12, itemKey: 't200' },
      ],
    });
  });

  it('returns null on a page without a cart', () => {
    expect(parseCart(fixtureText('me-fan-page.html'))).toBeNull();
  });

  it('reads the cart from a document', () => {
    document.body.innerHTML = '<script data-cart="{&quot;sync_num&quot;:2}"></script>';
    expect(readPageCart(document)).toEqual({ syncNum: 2, items: [] });
  });
});

describe('setInCart', () => {
  it('adds the digital release at its minimum price, to bandcamp.com', async () => {
    const f = fetchers({ [ALBUM_URL]: ALBUM }, [fixtureJson('cart_cb-add.json')]);

    const result = await setInCart(f, ALBUM_URL, {
      ...change,
      wanted: album.itemKey,
      inCart: true,
    });

    expect(result).toEqual({
      status: 'done',
      cart: { syncNum: 2, items: [{ lineId: 410362013, itemKey: album.itemKey }] },
    });
    const [request] = f.fetchJson.mock.calls[0] ?? [];
    expect(request?.url).toBe('https://bandcamp.com/cart/cb');
    expect(request?.init.headers).toMatchObject({ 'X-Requested-With': 'XMLHttpRequest' });
    expect(Object.fromEntries(body(request as BandcampRequest))).toMatchObject({
      req: 'add',
      item_type: 'a',
      item_id: album.itemKey.slice(1),
      unit_price: '9.99',
      band_id: String(album.bandId),
      sync_num: '1',
      cart_length: '0',
      fan_id: '7',
      local_id: '0.5',
    });
  });

  it('retries a stale add with the cart Bandcamp answers', async () => {
    const resync = {
      ...(fixtureJson('cart_cb-resync.json') as object),
      cart_data: { sync_num: 5, items: [line(9, 't', 42)] },
    };
    const f = fetchers({ [ALBUM_URL]: ALBUM }, [resync, fixtureJson('cart_cb-add.json')]);

    const result = await setInCart(f, ALBUM_URL, {
      ...change,
      wanted: album.itemKey,
      inCart: true,
    });

    const retry = body(f.fetchJson.mock.calls[1]?.[0] as BandcampRequest);
    expect([retry.get('sync_num'), retry.get('cart_length')]).toEqual(['5', '1']);
    expect(result.status === 'done' && result.cart.items.map((item) => item.itemKey)).toEqual([
      't42',
      album.itemKey,
    ]);
  });

  it('throws when Bandcamp still asks to resync', async () => {
    const resync = fixtureJson('cart_cb-resync.json');
    const f = fetchers({ [ALBUM_URL]: ALBUM }, [resync, resync]);

    await expect(
      setInCart(f, ALBUM_URL, { ...change, wanted: album.itemKey, inCart: true }),
    ).rejects.toBeInstanceOf(BandcampApiError);
  });

  it('reads the album page when the link is one of its tracks', async () => {
    const trackUrl = 'https://floatingpoints.bandcamp.com/track/movement-1';
    const wanted = parseReleasePage(TRACK).item.albumKey;
    const f = fetchers({ [trackUrl]: TRACK, [ALBUM_URL]: ALBUM }, [
      fixtureJson('cart_cb-add.json'),
    ]);

    await setInCart(f, trackUrl, { ...change, wanted: wanted ?? 'a0', inCart: true });

    expect(f.fetchText.mock.calls.map(([request]) => request.url)).toEqual([trackUrl, ALBUM_URL]);
    expect(body(f.fetchJson.mock.calls[0]?.[0] as BandcampRequest).get('unit_price')).toBe('9.99');
  });

  it('opens the page instead of adding a release with nothing to pay', async () => {
    const free = ALBUM.replace('minimum_price&quot;:9.99', 'minimum_price&quot;:0.0');
    const f = fetchers({ [ALBUM_URL]: free }, []);

    const result = await setInCart(f, ALBUM_URL, {
      ...change,
      wanted: album.itemKey,
      inCart: true,
    });

    expect(result).toEqual({ status: 'free', url: ALBUM_URL });
    expect(f.fetchJson).not.toHaveBeenCalled();
  });

  it('removes the release by its cart line', async () => {
    const id = Number(album.itemKey.slice(1));
    const page = withAttribute(ALBUM, 'cart', {
      sync_num: 3,
      items: [line(77, 'a', id), line(9, 't', 42)],
    });
    const f = fetchers({ [ALBUM_URL]: page }, [{ req: 'del', sync_num: 4 }]);

    const result = await setInCart(f, ALBUM_URL, {
      ...change,
      wanted: album.itemKey,
      inCart: false,
    });

    expect(Object.fromEntries(body(f.fetchJson.mock.calls[0]?.[0] as BandcampRequest))).toEqual({
      req: 'del',
      id: '77',
      sync_num: '3',
    });
    expect(result).toEqual({
      status: 'done',
      cart: { syncNum: 4, items: [{ lineId: 9, itemKey: 't42' }] },
    });
  });

  it('sends nothing to remove a release that is not in the cart', async () => {
    const f = fetchers({ [ALBUM_URL]: ALBUM }, []);

    const result = await setInCart(f, ALBUM_URL, {
      ...change,
      wanted: album.itemKey,
      inCart: false,
    });

    expect(result).toEqual({ status: 'done', cart: { syncNum: 1, items: [] } });
    expect(f.fetchJson).not.toHaveBeenCalled();
  });
});
