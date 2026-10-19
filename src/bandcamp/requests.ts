// Request builders for Bandcamp's internal endpoints. Pure: the worker does the actual fetching.

import type { TralbumType } from './types';

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

export function collectionItemsRequest(fanId: number, olderThanToken: string, count: number) {
  return postJson(`${API}/fancollection/1/collection_items`, {
    fan_id: fanId,
    older_than_token: olderThanToken,
    count,
  });
}

export function wishlistItemsRequest(fanId: number, olderThanToken: string, count: number) {
  return postJson(`${API}/fancollection/1/wishlist_items`, {
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

export function fanPageUrl(username: string): string {
  return `https://bandcamp.com/${encodeURIComponent(username)}`;
}

/** Cover image URL. Sizes in px: 7 → 150, 2 → 350, 5 → 700, 10 → 1200. */
export function artUrl(artId: number, size: 2 | 5 | 7 | 10 = 7): string {
  return `https://f4.bcbits.com/img/a${artId}_${size}.jpg`;
}
