// Adding to and removing from your wishlist, the way the heart on a release page does (decisions §6).

import type { FetchJson } from './collection';
import { BandcampApiError, ParserError } from './errors';
import { readDataAttribute } from './html';
import { parseItemKey } from './keys';
import type { FetchText } from './release';
import {
  signedInFanPageRequest,
  signedInReleasePageRequest,
  type WishlistEndpoint,
  wishlistItemRequest,
} from './requests';
import { rawCollectItemResponse, rawCrumbs, rawTralbum } from './schemas';
import type { ItemKey } from './types';
import { validate } from './validate';

type HeartCrumbs = Partial<Record<WishlistEndpoint, string>>;

/** What the heart's POST needs from a signed-in release page. */
export interface WishlistPage {
  /** The selling account, which sells the release, its album and its tracks alike. */
  bandId: number;
  /** Per endpoint. Empty when fetched logged out: Bandcamp only hands crumbs to a session. */
  crumbs: HeartCrumbs;
}

/** The heart crumbs in a page's `data-crumbs`: a release page's, or your own fan page's. */
function parseHeartCrumbs(html: string): HeartCrumbs {
  const json = readDataAttribute(html, 'crumbs');
  const crumbs = json === null ? {} : validate(rawCrumbs, json, 'data-crumbs');
  return { collect_item_cb: crumbs.collect_item_cb, uncollect_item_cb: crumbs.uncollect_item_cb };
}

export function parseWishlistPage(html: string): WishlistPage {
  const tralbumJson = readDataAttribute(html, 'tralbum');
  if (tralbumJson === null) throw new ParserError('release page', 'no data-tralbum attribute');
  const tralbum = validate(rawTralbum, tralbumJson, 'data-tralbum');
  return { bandId: tralbum.current.band_id, crumbs: parseHeartCrumbs(html) };
}

export type WishlistChange = { status: 'done' } | { status: 'signed-out' };

type Fetchers = { fetchText: FetchText; fetchJson: FetchJson };
interface Change {
  fanId: number;
  itemKey: ItemKey;
  wishlisted: boolean;
}

async function post(
  fetchJson: FetchJson,
  page: WishlistPage,
  change: Change,
): Promise<WishlistChange> {
  const endpoint: WishlistEndpoint = change.wishlisted ? 'collect_item_cb' : 'uncollect_item_cb';
  const crumb = page.crumbs[endpoint];
  if (crumb === undefined) return { status: 'signed-out' };
  const { type, tralbumId } = parseItemKey(change.itemKey);
  const response = await fetchJson(
    wishlistItemRequest(endpoint, {
      itemType: type === 'a' ? 'album' : 'track',
      itemId: tralbumId,
      bandId: page.bandId,
      fanId: change.fanId,
      crumb,
    }),
  );
  if (validate(rawCollectItemResponse, response, endpoint).error) {
    throw new BandcampApiError(endpoint);
  }
  return { status: 'done' };
}

/**
 * Reads the release page at `url` signed in, for its crumb and selling account, then adds
 * `itemKey` to your wishlist or takes it off. The item is the page's release, its album, or one
 * of its tracks: all are sold by the same account.
 */
export async function setWishlisted(
  fetchers: Fetchers,
  url: string,
  change: Change,
): Promise<WishlistChange> {
  const page = parseWishlistPage(await fetchers.fetchText(signedInReleasePageRequest(url)));
  return post(fetchers.fetchJson, page, change);
}

/**
 * The same change for a release whose page can't be fetched (a custom domain, decisions §5): the
 * crumb from your own fan page on bandcamp.com, and the selling account we already know.
 */
export async function setWishlistedFromFanPage(
  fetchers: Fetchers,
  change: Change & { username: string; bandId: number },
): Promise<WishlistChange> {
  const html = await fetchers.fetchText(signedInFanPageRequest(change.username));
  return post(
    fetchers.fetchJson,
    { bandId: change.bandId, crumbs: parseHeartCrumbs(html) },
    change,
  );
}
