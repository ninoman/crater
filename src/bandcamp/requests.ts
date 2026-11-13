// Request builders for Bandcamp's internal endpoints. Pure: the worker does the actual fetching.

import type { CollectionList, FollowingKind, TralbumType } from './types';

export interface BandcampRequest {
  url: string;
  init: RequestInit;
}

const API = 'https://bandcamp.com/api';

function postJson(url: string, body: object): BandcampRequest {
  return {
    url,
    init: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      credentials: 'include',
    },
  };
}

/** A token that starts a collection or wishlist from the newest item (decisions §1). */
export function firstPageToken(now = Date.now()): string {
  return `${Math.floor(now / 1000)}::a::`;
}

const LIST_ENDPOINTS: Record<CollectionList, string> = {
  collection: 'collection_items',
  wishlist: 'wishlist_items',
};

/** One page of a fan's collection or wishlist, older than the given token. */
export function collectionListRequest(
  list: CollectionList,
  fanId: number,
  olderThanToken: string,
  count: number,
) {
  return postJson(`${API}/fancollection/1/${LIST_ENDPOINTS[list]}`, {
    fan_id: fanId,
    older_than_token: olderThanToken,
    count,
  });
}

/** A token that starts a following list from the newest follow (decisions §8). */
export const FOLLOWING_FIRST_TOKEN = '9999999999:';

const FOLLOWING_ENDPOINTS: Record<FollowingKind, string> = {
  band: 'following_bands',
  fan: 'following_fans',
};

/** One page of the artists and labels, or the fans, a fan follows. */
export function followingRequest(
  kind: FollowingKind,
  fanId: number,
  olderThanToken: string,
  count: number,
) {
  return postJson(`${API}/fancollection/1/${FOLLOWING_ENDPOINTS[kind]}`, {
    fan_id: fanId,
    older_than_token: olderThanToken,
    count,
  });
}

/** A token that starts a release's supporters from the newest buyer, for albums and tracks. */
export const SUPPORTERS_FIRST_TOKEN = '1:9999999999:a::';

/** Next page of a release's supporters, after the last token seen. */
export function supportersRequest(
  kind: 'thumbs' | 'reviews',
  tralbumType: TralbumType,
  tralbumId: number,
  token: string,
  count: number,
) {
  return postJson(`${API}/tralbumcollectors/2/${kind}`, {
    tralbum_type: tralbumType,
    tralbum_id: tralbumId,
    token,
    count,
  });
}

/** Tab URL patterns for album and track pages, e.g. to send them scan progress. */
export const RELEASE_PAGE_PATTERNS = [
  'https://*.bandcamp.com/album/*',
  'https://*.bandcamp.com/track/*',
];

/** Tab URL pattern for fan pages, your profile among them. */
export const FAN_PAGE_PATTERNS = ['https://bandcamp.com/*'];

/**
 * Release pages live on artist subdomains of bandcamp.com. A custom domain 303s to one, but the
 * redirect fails CORS, so anything else is read through the mobile API (decisions §5).
 */
export function isBandcampUrl(url: string): boolean {
  try {
    const { protocol, hostname } = new URL(url);
    return (
      protocol === 'https:' && (hostname === 'bandcamp.com' || hostname.endsWith('.bandcamp.com'))
    );
  } catch {
    return false;
  }
}

/** An album or track page. Fetched logged out, like the fixtures, since nothing on it is personal. */
export function releasePageRequest(url: string): BandcampRequest {
  return { url, init: { credentials: 'omit' } };
}

/** A release page signed in, for the crumbs its own wishlist button posts with (decisions §6). */
export function signedInReleasePageRequest(url: string): BandcampRequest {
  return { url, init: { credentials: 'include' } };
}

/** Bandcamp's endpoints behind the heart: add to and remove from your wishlist. */
export type WishlistEndpoint = 'collect_item_cb' | 'uncollect_item_cb';

/**
 * The signed-in POSTs the extension makes for you (wishlist and cart), as a declarativeNetRequest
 * `regexFilter`. Bandcamp reads their Origin as a custom domain, so it must be bandcamp.com's,
 * not the extension's.
 */
export const SESSION_POST_REGEX =
  '^https://bandcamp\\.com/(collect_item_cb|uncollect_item_cb|cart/cb|collection_reorder_cb)$';
export const SESSION_POST_ORIGIN = 'https://bandcamp.com';

/**
 * Adds an album or track to the signed-in fan's wishlist, or takes it off, as the heart on its
 * page does: a form POST with the page's crumb for that endpoint. It goes to bandcamp.com, not the
 * release's host: from the extension, Bandcamp refuses the artist's subdomain ("request must use
 * the base domain").
 */
export function wishlistItemRequest(
  endpoint: WishlistEndpoint,
  fields: {
    fanId: number;
    itemType: 'album' | 'track';
    itemId: number;
    bandId: number;
    crumb: string;
  },
): BandcampRequest {
  const body = new URLSearchParams({
    fan_id: String(fields.fanId),
    item_id: String(fields.itemId),
    item_type: fields.itemType,
    band_id: String(fields.bandId),
    crumb: fields.crumb,
  });
  return {
    url: `https://bandcamp.com/${endpoint}`,
    init: {
      method: 'POST',
      // Without X-Requested-With, Bandcamp answers HTTP 400 "oops".
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: body.toString(),
      credentials: 'include',
    },
  };
}

/** Your own fan page signed in, for the crumb its collection grid reorders with (decisions §29). */
export function signedInFanPageRequest(username: string): BandcampRequest {
  return {
    url: `https://bandcamp.com/${encodeURIComponent(username)}`,
    init: { credentials: 'include' },
  };
}

/**
 * Saves the order of your collection, as dragging a card on your fan page does: every entry's
 * id in the new order, form-encoded the way jQuery sends an array (`ids[]` repeated).
 */
export function collectionReorderRequest(fields: {
  fanId: number;
  itemIds: readonly number[];
  crumb: string;
}): BandcampRequest {
  const body = new URLSearchParams({ fan_id: String(fields.fanId) });
  for (const id of fields.itemIds) body.append('ids[]', String(id));
  body.append('crumb', fields.crumb);
  return {
    url: 'https://bandcamp.com/collection_reorder_cb',
    init: {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: body.toString(),
      credentials: 'include',
    },
  };
}

/** A line for the digital album or track, as the buy dialog's "Add to cart" sends it. */
export interface CartAdd {
  itemType: 'album' | 'track';
  itemId: number;
  bandId: number;
  /** In the seller's currency. */
  unitPrice: number;
  /** Null when we don't know who you are: guests have carts too. */
  fanId: number | null;
  /** Random, as Bandcamp's own cart script makes it. */
  localId: string;
}

/** The cart's state as last seen; Bandcamp answers `resync` when it's stale. */
export interface CartSync {
  syncNum: number;
  cartLength: number;
}

function cartRequest(fields: Record<string, string>): BandcampRequest {
  return {
    // bandcamp.com, like the wishlist POSTs.
    url: 'https://bandcamp.com/cart/cb',
    init: {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: new URLSearchParams(fields).toString(),
      credentials: 'include',
    },
  };
}

/** Adds one line to your Bandcamp cart. */
export function cartAddRequest(add: CartAdd, sync: CartSync): BandcampRequest {
  return cartRequest({
    req: 'add',
    local_id: add.localId,
    item_type: add.itemType === 'album' ? 'a' : 't',
    item_id: String(add.itemId),
    unit_price: String(add.unitPrice),
    quantity: '1',
    band_id: String(add.bandId),
    is_cardable: 'true',
    cart_length: String(sync.cartLength),
    sync_num: String(sync.syncNum),
    ...(add.fanId === null ? {} : { fan_id: String(add.fanId) }),
  });
}

/** Takes one line, by its id, out of your cart. */
export function cartDeleteRequest(lineId: number, sync: CartSync): BandcampRequest {
  return cartRequest({ req: 'del', id: String(lineId), sync_num: String(sync.syncNum) });
}

export function fanPageUrl(username: string): string {
  return `https://bandcamp.com/${encodeURIComponent(username)}`;
}

/**
 * A fan's profile page, signed in: Bandcamp only renders "N items in common" for a viewer
 * (decisions §12), unlike release pages, which are fetched logged out.
 */
export function fanProfileRequest(username: string): BandcampRequest {
  return { url: fanPageUrl(username), init: { credentials: 'include' } };
}

/** A fan's avatar (`image_id`), 50×50 as on Bandcamp's supporter thumbnails. */
export function fanImageUrl(imageId: number): string {
  return `https://f4.bcbits.com/img/${String(imageId).padStart(10, '0')}_42.jpg`;
}

/** Cover image URL. Sizes in px: 7 → 150, 2 → 350, 5 → 700, 10 → 1200. */
export function artUrl(artId: number, size: 2 | 5 | 7 | 10 = 7): string {
  return `https://f4.bcbits.com/img/a${artId}_${size}.jpg`;
}

/** The avatar Bandcamp shows on its following cards, 50×50. */
export function followingImageUrl(imageId: number): string {
  return `https://f4.bcbits.com/img/${String(imageId).padStart(10, '0')}_41.jpg`;
}

// A band's releases come from the mobile app's public API (decisions §23). Logged out, since
// nothing in them is personal, and on bandcamp.com, so custom domains never redirect them away.
const MOBILE_API = `${API}/mobile/24`;

function publicPostJson(url: string, body: object): BandcampRequest {
  const request = postJson(url, body);
  return { url, init: { ...request.init, credentials: 'omit' } };
}

/** Everything a band account sells, with release dates: its own releases and, for a label, its artists'. */
export function bandDetailsRequest(bandId: number): BandcampRequest {
  return publicPostJson(`${MOBILE_API}/band_details`, { band_id: bandId });
}

/** One release's details, for its URL. `bandId` is the account selling it. */
export function tralbumDetailsRequest(
  bandId: number,
  tralbumType: TralbumType,
  tralbumId: number,
): BandcampRequest {
  return publicPostJson(`${MOBILE_API}/tralbum_details`, {
    band_id: bandId,
    tralbum_type: tralbumType,
    tralbum_id: tralbumId,
  });
}
