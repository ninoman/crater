// Raw Bandcamp shapes, validated with zod. Only the fields we use are declared; the rest is ignored.
// Recorded samples of each shape live in tests/fixtures.

import { z } from 'zod';

const apiError = z.object({ error: z.literal(true) });

export const rawCollectionItem = z.object({
  item_type: z.string(),
  tralbum_id: z.number(),
  /** 'a' or 't' for releases; subscriptions use 's'. */
  tralbum_type: z.string(),
  album_id: z.number().nullish(),
  item_title: z.string(),
  band_id: z.number(),
  band_name: z.string(),
  /** Set when the release is on a label but sold from the artist's own account. */
  label: z.string().nullish(),
  label_id: z.number().nullish(),
  also_collected_count: z.number().nullish(),
  item_art_id: z.number().nullish(),
  item_url: z.string(),
  purchased: z.string().nullish(),
  added: z.string().nullish(),
  /** This item's position in the list, usable as older_than_token for the next page. */
  token: z.string().nullish(),
});
export type RawCollectionItem = z.infer<typeof rawCollectionItem>;

export const rawCollectionResponse = z.union([
  apiError,
  z.object({
    items: z.array(rawCollectionItem),
    more_available: z.boolean(),
    last_token: z.string().nullable(),
  }),
]);

export const rawSupporter = z.object({
  fan_id: z.number(),
  username: z.string(),
  name: z.string().nullish(),
  image_id: z.number().nullish(),
  token: z.string(),
});
export type RawSupporter = z.infer<typeof rawSupporter>;

export const rawSupportersResponse = z.union([
  apiError,
  z.object({ results: z.array(rawSupporter), more_available: z.boolean() }),
]);

export const rawCollectorsBlob = z.object({
  thumbs: z.array(rawSupporter),
  reviews: z.array(rawSupporter),
  more_thumbs_available: z.boolean(),
  more_reviews_available: z.boolean(),
});

export const rawTralbum = z.object({
  id: z.number(),
  item_type: z.enum(['album', 'track']),
  artist: z.string(),
  art_id: z.number().nullish(),
  url: z.string(),
  current: z.object({
    title: z.string(),
    band_id: z.number(),
    album_id: z.number().nullish(),
  }),
  /** A track's own artist line: null on a normal album, set per track on a compilation. */
  trackinfo: z.array(z.object({ artist: z.string().nullish() })).nullish(),
});

/** The tracks a release page can stream. `file` is null for tracks Bandcamp won't play. */
export const rawTralbumTracks = z.object({
  id: z.number().nullish(),
  item_type: z.enum(['album', 'track']).nullish(),
  current: z.object({ album_id: z.number().nullish() }).nullish(),
  featured_track_id: z.number().nullish(),
  trackinfo: z.array(
    z.object({
      track_id: z.number().nullish(),
      title: z.string().nullish(),
      duration: z.number().nullish(),
      file: z.object({ 'mp3-128': z.string().nullish() }).nullish(),
    }),
  ),
});

export const rawLdJson = z.object({
  keywords: z.union([z.array(z.string()), z.string()]).nullish(),
  /** On a track page, the album it's from. */
  inAlbum: z.object({ name: z.string().nullish() }).nullish(),
});

const rawViewer = z.object({ id: z.number(), username: z.string() });

/** The part of any page's `#pagedata` that names the logged-in fan. */
export const rawViewerPagedata = z.object({
  identities: z.object({ fan: rawViewer.nullish() }).nullish(),
});

/** The part of a fan page's `#pagedata` that says whether it's the logged-in fan's own. */
export const rawOwnPagePagedata = z.object({
  fan_data: z.object({ is_own_page: z.boolean().nullish() }).nullish(),
});

/** The part of a fan page's `#pagedata` that says whose page it is. */
export const rawViewedFanPagedata = z.object({
  fan_data: z.object({ fan_id: z.number() }),
});

/** The part of a band page's `data-band` attribute that says whose page it is. */
export const rawBandData = z.object({ id: z.number() });

/** `data-tralbum` on a band's home page holds only a url; on a release page it has the item. */
export const rawTralbumMarker = z.object({ id: z.number().nullish() });

const rawListData = z.object({
  item_count: z.number(),
  last_token: z.string().nullable(),
  sequence: z.array(z.string()).nullish(),
});

export const rawFanPagedata = z.object({
  fan_data: z.object({
    fan_id: z.number(),
    username: z.string(),
    name: z.string().nullish(),
    is_own_page: z.boolean().nullish(),
  }),
  collection_data: rawListData.extend({ hidden_items_count: z.number().nullish() }),
  wishlist_data: rawListData.extend({ hidden: z.boolean().nullish() }),
  item_cache: z.object({ collection: z.record(z.string(), rawCollectionItem) }),
  identities: z.object({ fan: rawViewer.nullable() }),
});

/** What a fan page's `#pagedata` says about the fan for ranking them (decisions §12). */
export const rawFanProfilePagedata = z.object({
  fan_data: z.object({
    fan_id: z.number(),
    username: z.string(),
    is_own_page: z.boolean().nullish(),
    location: z.string().nullish(),
    fav_genre: z.string().nullish(),
  }),
  collection_data: z.object({ item_count: z.number() }),
  identities: z.object({ fan: rawViewer.nullable() }),
});

/** One row of `following_bands` / `following_fans` and of the fan page's `item_cache.following_*`. */
export const rawFollowee = z.object({
  /** Set on band rows only. */
  band_id: z.number().nullish(),
  /** Set on fan rows only. */
  fan_id: z.number().nullish(),
  name: z.string(),
  image_id: z.number().nullish(),
  url_hints: z
    .object({ subdomain: z.string().nullish(), custom_domain: z.string().nullish() })
    .nullish(),
  /** A fan's profile URL; username is its path. */
  trackpipe_url: z.string().nullish(),
  location: z.string().nullish(),
  date_followed: z.string().nullish(),
  token: z.string().nullish(),
});
export type RawFollowee = z.infer<typeof rawFollowee>;

export const rawFollowingResponse = z.union([
  apiError,
  z.object({
    followeers: z.array(rawFollowee),
    more_available: z.boolean(),
    last_token: z.string().nullable(),
  }),
]);

const rawFollowingData = z.object({
  item_count: z.number(),
  last_token: z.string().nullable(),
  /** Display order of the rows in `item_cache`, whose keys JS sorts numerically. */
  pending_sequence: z.array(z.string()).nullish(),
});

/** The part of a fan page's `#pagedata` that holds the first followings. */
export const rawFollowingPagedata = z.object({
  following_bands_data: rawFollowingData,
  following_fans_data: rawFollowingData,
  item_cache: z.object({
    following_bands: z.record(z.string(), rawFollowee),
    following_fans: z.record(z.string(), rawFollowee),
  }),
});
