// Your Bandcamp cart: reading it from a page, and adding or removing a digital release the way
// the buy dialog and the cart's own "remove" do.

import type { FetchJson } from './collection';
import { rawApiReleaseResponse } from './discographySchemas';
import { BandcampApiError, ParserError } from './errors';
import { readDataAttribute } from './html';
import { itemKey, parseItemKey } from './keys';
import type { FetchText } from './release';
import {
  type CartAdd,
  type CartSync,
  cartAddRequest,
  cartDeleteRequest,
  signedInReleasePageRequest,
  tralbumDetailsRequest,
} from './requests';
import { rawCart, rawCartResponse, rawTralbum } from './schemas';
import type { ItemKey } from './types';
import { assertNotApiError, validate } from './validate';

/** One line of your cart: albums and tracks only, since packages aren't recommended. */
export interface CartItem {
  lineId: number;
  itemKey: ItemKey;
}

export interface Cart {
  syncNum: number;
  items: CartItem[];
}

/** What Bandcamp's own script assumes of a cart it has seen nothing of. */
const EMPTY_CART: Cart = { syncNum: 1, items: [] };

function toCart(json: unknown, source: string): Cart {
  const raw = validate(rawCart, json, source);
  const items = (raw.items ?? []).flatMap((item): CartItem[] =>
    item.item_type === 'a' || item.item_type === 't'
      ? [{ lineId: item.id, itemKey: itemKey(item.item_type, item.item_id) }]
      : [],
  );
  return { syncNum: raw.sync_num ?? EMPTY_CART.syncNum, items };
}

/**
 * The cart a release or band page carries in `data-cart`. Accepts a whole page or the element's
 * outerHTML. Null on pages without one, such as fan pages.
 */
export function parseCart(html: string): Cart | null {
  const json = readDataAttribute(html, 'cart');
  return json === null ? null : toCart(json, 'data-cart');
}

/** The cart on the page in this document, from Bandcamp's own markup. */
export function readPageCart(doc: Document): Cart | null {
  const element = doc.querySelector('[data-cart]');
  return element ? parseCart(element.outerHTML) : null;
}

interface CartPage {
  item: Omit<CartAdd, 'fanId' | 'localId'> & { itemKey: ItemKey };
  /** Null or 0 when it's free or name-your-price from nothing: no cart line for those. */
  price: number | null;
  /** On a track of an album, the album's page. */
  albumUrl: string | null;
  /** On an album, its tracks' pages. */
  trackUrls: ReadonlyMap<ItemKey, string>;
  cart: Cart;
}

function parseCartPage(html: string, pageUrl: string): CartPage {
  const json = readDataAttribute(html, 'tralbum');
  if (json === null) throw new ParserError('release page', 'no data-tralbum attribute');
  const tralbum = validate(rawTralbum, json, 'data-tralbum');
  const price = tralbum.current.minimum_price ?? null;
  return {
    item: {
      itemKey: itemKey(tralbum.item_type === 'album' ? 'a' : 't', tralbum.id),
      itemType: tralbum.item_type,
      itemId: tralbum.id,
      bandId: tralbum.current.band_id,
      unitPrice: price ?? 0,
    },
    price,
    albumUrl: tralbum.album_url ? new URL(tralbum.album_url, pageUrl).href : null,
    trackUrls: new Map(
      (tralbum.trackinfo ?? []).flatMap(({ track_id: id, title_link: link }) =>
        id != null && link ? [[itemKey('t', id), new URL(link, pageUrl).href] as const] : [],
      ),
    ),
    cart: parseCart(html) ?? EMPTY_CART,
  };
}

export type CartChange =
  | { status: 'done'; cart: Cart }
  /** Nothing to pay: open its page instead. */
  | { status: 'free'; url: string };

type Fetchers = { fetchText: FetchText; fetchJson: FetchJson };

/**
 * Reads `url` signed in. When it's a track of the album wanted, reads the album's page; when it's
 * the album of the track wanted, the track's.
 */
async function readPage(fetchers: Fetchers, url: string, wanted: ItemKey) {
  const read = async (pageUrl: string) =>
    parseCartPage(await fetchers.fetchText(signedInReleasePageRequest(pageUrl)), pageUrl);
  const page = await read(url);
  const next = page.trackUrls.get(wanted) ?? page.albumUrl;
  if (page.item.itemKey === wanted || next === null) return { page, url };
  return { page: await read(next), url: next };
}

const syncOf = (cart: Cart): CartSync => ({ syncNum: cart.syncNum, cartLength: cart.items.length });

/**
 * Sends a cart request built from the cart as we know it. A stale state gets one retry with the
 * cart Bandcamp answers. Returns the answer and the cart it applied to.
 */
async function sendSynced(
  fetchers: Fetchers,
  cart: Cart,
  request: (cart: Cart) => Parameters<FetchJson>[0] | null,
) {
  const send = async (current: Cart) => {
    const built = request(current);
    if (built === null) return null;
    return validate(rawCartResponse, await fetchers.fetchJson(built), 'cart/cb');
  };
  let current = cart;
  let response = await send(current);
  if (response?.resync && response.cart_data) {
    current = toCart(response.cart_data, 'cart_data');
    response = await send(current);
  }
  if (response && (response.resync || response.unexpected_error)) {
    throw new BandcampApiError('cart/cb');
  }
  return { response, cart: current };
}

interface Change {
  wanted: ItemKey;
  inCart: boolean;
  fanId: number | null;
  localId: () => string;
}

const others = (cart: Cart, wanted: ItemKey) =>
  cart.items.filter((item) => item.itemKey !== wanted);

async function removeLine(fetchers: Fetchers, start: Cart, wanted: ItemKey): Promise<CartChange> {
  const { response, cart } = await sendSynced(fetchers, start, (current) => {
    const line = current.items.find((item) => item.itemKey === wanted);
    return line ? cartDeleteRequest(line.lineId, syncOf(current)) : null;
  });
  const syncNum = response?.sync_num ?? cart.syncNum;
  return { status: 'done', cart: { syncNum, items: others(cart, wanted) } };
}

async function addLine(
  fetchers: Fetchers,
  page: CartPage,
  pageUrl: string,
  change: Change,
): Promise<CartChange> {
  if (!page.price) return { status: 'free', url: pageUrl };
  const add = { ...page.item, fanId: change.fanId, localId: change.localId() };
  const { response, cart } = await sendSynced(fetchers, page.cart, (current) =>
    cartAddRequest(add, syncOf(current)),
  );
  if (response?.id == null) throw new BandcampApiError('cart/cb');
  return {
    status: 'done',
    cart: {
      syncNum: response.sync_num ?? cart.syncNum,
      items: [...others(cart, change.wanted), { lineId: response.id, itemKey: change.wanted }],
    },
  };
}

/**
 * Adds the digital `wanted` to your cart at its minimum price, or takes it out. `url` is its page,
 * one of its tracks' or, for a track, its album's. Answers the cart as it now stands.
 */
export async function setInCart(
  fetchers: Fetchers,
  url: string,
  change: Change,
): Promise<CartChange> {
  const { page, url: pageUrl } = await readPage(fetchers, url, change.wanted);
  return change.inCart
    ? addLine(fetchers, page, pageUrl, change)
    : removeLine(fetchers, page.cart, change.wanted);
}

/** A release as `tralbum_details` tells it, shaped like the page it stands in for. */
function parseApiCartPage(json: unknown, cart: Cart): { page: CartPage; url: string } {
  const data = assertNotApiError(
    validate(rawApiReleaseResponse, json, 'tralbum_details'),
    'tralbum_details',
  );
  const payable = data.is_purchasable !== false && !data.free_download;
  const price = payable ? (data.price ?? null) : null;
  return {
    page: {
      item: {
        itemKey: itemKey(data.type, data.id),
        itemType: data.type === 'a' ? 'album' : 'track',
        itemId: data.id,
        bandId: data.band.band_id,
        unitPrice: price ?? 0,
      },
      price,
      albumUrl: null,
      trackUrls: new Map(),
      cart,
    },
    url: data.bandcamp_url,
  };
}

/**
 * The same change for a release whose page can't be fetched (a custom domain, decisions §5):
 * its price from `tralbum_details` on bandcamp.com, the cart from our copy (`cart`, null when we
 * have none, in which case Bandcamp's resync answer supplies it). Opens `url` instead when the
 * price can't be read.
 */
export async function setInCartFromApi(
  fetchers: Fetchers,
  release: { url: string; sellerId: number; cart: Cart | null },
  change: Change,
): Promise<CartChange> {
  const cart = release.cart ?? EMPTY_CART;
  if (!change.inCart) return removeLine(fetchers, cart, change.wanted);
  const { type, tralbumId } = parseItemKey(change.wanted);
  let read: { page: CartPage; url: string };
  try {
    read = parseApiCartPage(
      await fetchers.fetchJson(tralbumDetailsRequest(release.sellerId, type, tralbumId)),
      cart,
    );
  } catch (error) {
    // An answer we can't read: its page still sells it. Offline or throttled fails as usual.
    if (error instanceof ParserError || error instanceof BandcampApiError) {
      return { status: 'free', url: release.url };
    }
    throw error;
  }
  return addLine(fetchers, read.page, read.url, change);
}
