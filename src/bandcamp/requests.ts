// Request builders for Bandcamp's internal endpoints. Pure: the worker does the actual fetching.

import type { CollectionList, ItemKey, TralbumType } from './types';

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

/** Release pages live on artist subdomains of bandcamp.com (custom domains are out of scope). */
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

export function fanPageUrl(username: string): string {
  return `https://bandcamp.com/${encodeURIComponent(username)}`;
}

/** Bandcamp's own small player, as used for previews (the page's `twitter:player` uses v=2 too). */
export function embeddedPlayerUrl(key: ItemKey): string {
  const kind = key[0] === 'a' ? 'album' : 'track';
  return `https://bandcamp.com/EmbeddedPlayer/v=2/${kind}=${key.slice(1)}/size=small/bgcol=ffffff/linkcol=1da0c3/transparent=true/`;
}

/** Cover image URL. Sizes in px: 7 → 150, 2 → 350, 5 → 700, 10 → 1200. */
export function artUrl(artId: number, size: 2 | 5 | 7 | 10 = 7): string {
  return `https://f4.bcbits.com/img/a${artId}_${size}.jpg`;
}
