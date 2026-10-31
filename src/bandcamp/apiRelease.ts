// A release as the mobile API tells it, for custom domains, whose pages can't be fetched
// (decisions §5).

import type { FetchJson } from './collection';
import { isCompilation } from './compilation';
import { rawApiReleaseResponse } from './discographySchemas';
import { itemKey, parseItemKey } from './keys';
import { tralbumDetailsRequest } from './requests';
import type { ItemKey, ReleasePage, ReleasePreview } from './types';
import { assertNotApiError, validate } from './validate';

/** The parts of a release page the API can stand in for: supporters are fetched separately. */
export type ApiRelease = Pick<ReleasePage, 'item' | 'album'>;

function parseResponse(json: unknown) {
  return assertNotApiError(
    validate(rawApiReleaseResponse, json, 'tralbum_details'),
    'tralbum_details',
  );
}

export function parseApiRelease(json: unknown): ApiRelease {
  const data = parseResponse(json);
  const albumKey = data.type === 't' && data.album_id != null ? itemKey('a', data.album_id) : null;
  const tags = (data.tags ?? []).map((tag) => tag.name.trim().toLowerCase());
  return {
    item: {
      itemKey: itemKey(data.type, data.id),
      albumKey,
      title: data.title,
      artist: data.tralbum_artist,
      bandId: data.band.band_id,
      url: data.bandcamp_url,
      artId: data.art_id ?? null,
      tags: [...new Set(tags)],
      compilation: isCompilation({
        artist: data.tralbum_artist,
        title: data.title,
        trackArtists: (data.tracks ?? []).map((track) => track.band_name ?? null),
        albumTitle: data.type === 't' ? data.album_title : null,
      }),
    },
    // The API names no album URL. Only its host matters: the album's own job reads the real one.
    album: albumKey && { itemKey: albumKey, url: new URL(data.bandcamp_url).origin },
  };
}

export function parseApiReleasePreview(json: unknown): ReleasePreview {
  const data = parseResponse(json);
  const tracks = (data.tracks ?? []).flatMap((track) => {
    const streamUrl = track.streaming_url?.['mp3-128'];
    if (!streamUrl) return [];
    return [{ id: track.track_id, title: track.title, duration: track.duration ?? 0, streamUrl }];
  });
  return {
    matchKey: itemKey(data.album_id == null ? data.type : 'a', data.album_id ?? data.id),
    tracks: tracks.map(({ id: _id, ...track }) => track),
    startIndex: Math.max(
      0,
      tracks.findIndex((track) => track.id === data.featured_track_id),
    ),
  };
}

function detailsRequest(sellerId: number, key: ItemKey) {
  const { type, tralbumId } = parseItemKey(key);
  return tralbumDetailsRequest(sellerId, type, tralbumId);
}

export async function fetchApiRelease(
  fetchJson: FetchJson,
  sellerId: number,
  key: ItemKey,
): Promise<ApiRelease> {
  return parseApiRelease(await fetchJson(detailsRequest(sellerId, key)));
}

export async function fetchApiReleasePreview(
  fetchJson: FetchJson,
  sellerId: number,
  key: ItemKey,
): Promise<ReleasePreview> {
  return parseApiReleasePreview(await fetchJson(detailsRequest(sellerId, key)));
}
