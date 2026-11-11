// Your Bandcamp cart: reading it from a page, and adding or removing a digital release the way
// the buy dialog and the cart's own "remove" do.

import type { FetchJson } from './collection';
import { BandcampApiError, ParserError } from './errors';
import { readDataAttribute } from './html';
import { itemKey } from './keys';
import type { FetchText } from './release';
import {
  type CartAdd,
  type CartSync,
  cartAddRequest,
  cartDeleteRequest,
  signedInReleasePageRequest,
} from './requests';
import { rawCart, rawCartResponse, rawTralbum } from './schemas';
import type { ItemKey } from './types';
import { validate } from './validate';

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
    cart: parseCart(html) ?? EMPTY_CART,
  };
}

export type CartChange =
  | { status: 'done'; cart: Cart }
  /** Nothing to pay: open its page instead. */
  | { status: 'free'; url: string };

type Fetchers = { fetchText: FetchText; fetchJson: FetchJson };

/** Reads `url` signed in; when it's a track of the album wanted, reads the album's page. */
async function readPage(fetchers: Fetchers, url: string, wanted: ItemKey) {
  const read = async (pageUrl: string) =>
    parseCartPage(await fetchers.fetchText(signedInReleasePageRequest(pageUrl)), pageUrl);
  const page = await read(url);
  if (page.item.itemKey === wanted || page.albumUrl === null) return { page, url };
  return { page: await read(page.albumUrl), url: page.albumUrl };
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

/**
 * Adds the digital `wanted` to your cart at its minimum price, or takes it out. `url` is its page
 * or one of its tracks'. Answers the cart as it now stands.
 */
export async function setInCart(
  fetchers: Fetchers,
  url: string,
  change: { wanted: ItemKey; inCart: boolean; fanId: number | null; localId: () => string },
): Promise<CartChange> {
  const { page, url: pageUrl } = await readPage(fetchers, url, change.wanted);
  const others = (cart: Cart) => cart.items.filter((item) => item.itemKey !== change.wanted);

  if (!change.inCart) {
    const lineOf = (cart: Cart) => cart.items.find((item) => item.itemKey === change.wanted);
    const { response, cart } = await sendSynced(fetchers, page.cart, (current) => {
      const line = lineOf(current);
      return line ? cartDeleteRequest(line.lineId, syncOf(current)) : null;
    });
    const syncNum = response?.sync_num ?? cart.syncNum;
    return { status: 'done', cart: { syncNum, items: others(cart) } };
  }

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
      items: [...others(cart), { lineId: response.id, itemKey: change.wanted }],
    },
  };
}
