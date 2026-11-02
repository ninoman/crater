// Raw shapes of the mobile API's band and release details (decisions §23). Only the fields we
// use are declared. Samples: tests/fixtures/band_details*.json, tralbum_details*.json.

import { z } from 'zod';

const apiError = z.object({ error: z.literal(true), error_message: z.string().nullish() });

export const rawDiscographyItem = z.object({
  item_id: z.number(),
  /** `album` or `track`; anything else is skipped. */
  item_type: z.string(),
  /** Set when a label sells it, or when the artist line differs from the account's name. */
  artist_name: z.string().nullish(),
  band_name: z.string(),
  band_id: z.number(),
  title: z.string(),
  art_id: z.number().nullish(),
  /** "28 Aug 2026 00:00:00 GMT". */
  release_date: z.string().nullish(),
});
export type RawDiscographyItem = z.infer<typeof rawDiscographyItem>;

export const rawBandDetailsResponse = z.union([
  apiError,
  z.object({
    id: z.number(),
    name: z.string(),
    discography: z.array(rawDiscographyItem),
  }),
]);

export const rawTralbumDetailsResponse = z.union([
  apiError,
  z.object({
    id: z.number(),
    type: z.enum(['a', 't']),
    bandcamp_url: z.string(),
    /** Set on a track that belongs to an album. */
    album_id: z.number().nullish(),
    /** Unix seconds. */
    release_date: z.number().nullish(),
    is_preorder: z.boolean().nullish(),
  }),
]);

const rawApiTrack = z.object({
  track_id: z.number(),
  title: z.string(),
  duration: z.number().nullish(),
  band_name: z.string().nullish(),
  streaming_url: z.object({ 'mp3-128': z.string().nullish() }).nullish(),
});

/** What the mobile API says of a release in place of its page. */
export const rawApiReleaseResponse = z.union([
  apiError,
  z.object({
    id: z.number(),
    type: z.enum(['a', 't']),
    title: z.string(),
    bandcamp_url: z.string(),
    art_id: z.number().nullish(),
    tralbum_artist: z.string(),
    band: z.object({ band_id: z.number() }),
    album_id: z.number().nullish(),
    album_title: z.string().nullish(),
    featured_track_id: z.number().nullish(),
    tags: z.array(z.object({ name: z.string() })).nullish(),
    tracks: z.array(rawApiTrack).nullish(),
  }),
]);
