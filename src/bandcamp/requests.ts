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
