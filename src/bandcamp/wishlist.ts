// Adding to and removing from your wishlist, the way the heart on a release page does (decisions §6).

import type { FetchJson } from './collection';
import { BandcampApiError, ParserError } from './errors';
import { readDataAttribute } from './html';
import { parseItemKey } from './keys';
import type { FetchText } from './release';
import { signedInReleasePageRequest, type WishlistEndpoint, wishlistItemRequest } from './requests';
import { rawCollectItemResponse, rawCrumbs, rawTralbum } from './schemas';
import type { ItemKey } from './types';
import { validate } from './validate';

/** What the heart's POST needs from a signed-in release page. */
export interface WishlistPage {
  /** The selling account, which sells the release, its album and its tracks alike. */
  bandId: number;
  /** Per endpoint. Empty when fetched logged out: Bandcamp only hands crumbs to a session. */
  crumbs: Partial<Record<WishlistEndpoint, string>>;
}

export function parseWishlistPage(html: string): WishlistPage {
  const tralbumJson = readDataAttribute(html, 'tralbum');
  if (tralbumJson === null) throw new ParserError('release page', 'no data-tralbum attribute');
  const tralbum = validate(rawTralbum, tralbumJson, 'data-tralbum');
  const crumbsJson = readDataAttribute(html, 'crumbs');
  const crumbs = crumbsJson === null ? {} : validate(rawCrumbs, crumbsJson, 'data-crumbs');
  return {
    bandId: tralbum.current.band_id,
    crumbs: {
      collect_item_cb: crumbs.collect_item_cb,
      uncollect_item_cb: crumbs.uncollect_item_cb,
    },
  };
}

export type WishlistChange = { status: 'done' } | { status: 'signed-out' };

/**
 * Reads the release page at `url` signed in, for its crumb and selling account, then adds
 * `itemKey` to your wishlist or takes it off. The item is the page's release, its album, or one
 * of its tracks: all are sold by the same account.
 */
export async function setWishlisted(
  fetchers: { fetchText: FetchText; fetchJson: FetchJson },
  url: string,
  change: { fanId: number; itemKey: ItemKey; wishlisted: boolean },
): Promise<WishlistChange> {
  const page = parseWishlistPage(await fetchers.fetchText(signedInReleasePageRequest(url)));
  const endpoint: WishlistEndpoint = change.wishlisted ? 'collect_item_cb' : 'uncollect_item_cb';
  const crumb = page.crumbs[endpoint];
  if (crumb === undefined) return { status: 'signed-out' };
  const { type, tralbumId } = parseItemKey(change.itemKey);
  const response = await fetchers.fetchJson(
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
