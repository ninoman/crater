// Raw Bandcamp shapes, validated with zod. Only the fields we use are declared; the rest is ignored.
// Recorded samples of each shape live in tests/fixtures.

import { z } from 'zod';

const apiError = z.object({ error: z.literal(true) });

export const rawCollectionItem = z.object({
  item_type: z.string(),
  tralbum_id: z.number(),
  tralbum_type: z.enum(['a', 't']),
  album_id: z.number().nullish(),
  item_title: z.string(),
  band_id: z.number(),
  band_name: z.string(),
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
});

export const rawLdJson = z.object({
  keywords: z.union([z.array(z.string()), z.string()]).nullish(),
});

const rawViewer = z.object({ id: z.number(), username: z.string() });

/** The part of any page's `#pagedata` that names the logged-in fan. */
export const rawViewerPagedata = z.object({
  identities: z.object({ fan: rawViewer.nullish() }).nullish(),
});

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
