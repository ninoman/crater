// A band account's releases and one release's details, from the mobile app's public API
// (decisions §22).

import type { FetchJson } from './collection';
import {
  rawBandDetailsResponse,
  rawTralbumDetailsResponse,
  type RawDiscographyItem,
} from './discographySchemas';
import { itemKey, parseBandcampDate, parseItemKey } from './keys';
import { bandDetailsRequest, tralbumDetailsRequest } from './requests';
import type { Discography, DiscographyRelease, ItemKey, ReleaseDetails } from './types';
import { assertNotApiError, validate } from './validate';

const ITEM_TYPES: Record<string, 'a' | 't'> = { album: 'a', track: 't' };

/** Maps one discography entry. Returns null for kinds we don't track (merch, say). */
export function toDiscographyRelease(raw: RawDiscographyItem): DiscographyRelease | null {
  const type = ITEM_TYPES[raw.item_type];
  if (!type) return null;
  return {
    itemKey: itemKey(type, raw.item_id),
    sellerId: raw.band_id,
    title: raw.title,
    artist: raw.artist_name || raw.band_name,
    artId: raw.art_id ?? null,
    releasedAt: parseBandcampDate(raw.release_date),
  };
}

/** Parses a band_details response. An unknown band is a BandcampApiError. */
export function parseDiscography(json: unknown): Discography {
  const data = assertNotApiError(
    validate(rawBandDetailsResponse, json, 'band_details'),
    'band_details',
  );
  return {
    bandId: data.id,
    name: data.name,
    releases: data.discography.flatMap((raw) => toDiscographyRelease(raw) ?? []),
  };
}

/** Parses a tralbum_details response. A release that's gone is a BandcampApiError. */
export function parseReleaseDetails(json: unknown): ReleaseDetails {
  const data = assertNotApiError(
    validate(rawTralbumDetailsResponse, json, 'tralbum_details'),
    'tralbum_details',
  );
  return {
    itemKey: itemKey(data.type, data.id),
    albumKey: data.type === 't' && data.album_id != null ? itemKey('a', data.album_id) : null,
    url: data.bandcamp_url,
    releasedAt: data.release_date ? data.release_date * 1000 : null,
    preorder: data.is_preorder ?? false,
  };
}

export async function fetchDiscography(fetchJson: FetchJson, bandId: number): Promise<Discography> {
  return parseDiscography(await fetchJson(bandDetailsRequest(bandId)));
}

/** `sellerId` is the account selling the release, which for a label's artist isn't the label. */
export async function fetchReleaseDetails(
  fetchJson: FetchJson,
  sellerId: number,
  key: ItemKey,
): Promise<ReleaseDetails> {
  const { type, tralbumId } = parseItemKey(key);
  return parseReleaseDetails(await fetchJson(tralbumDetailsRequest(sellerId, type, tralbumId)));
}
