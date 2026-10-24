import { ParserError } from './errors';
import { readDataAttribute } from './html';
import { itemKey } from './keys';
import type { FetchText } from './release';
import { releasePageRequest } from './requests';
import { rawTralbumTracks } from './schemas';
import type { ItemKey, PreviewTrack, ReleasePreview } from './types';
import { validate } from './validate';

/** Reads the streamable tracks from an album or track page's `data-tralbum`. */
export function parseReleasePreview(html: string): ReleasePreview {
  const json = readDataAttribute(html, 'tralbum');
  if (json === null) throw new ParserError('release page', 'no data-tralbum attribute');
  const tralbum = validate(rawTralbumTracks, json, 'data-tralbum');
  const { featured_track_id: featured, trackinfo } = tralbum;

  const tracks: (PreviewTrack & { id: number | null })[] = [];
  for (const raw of trackinfo) {
    const streamUrl = raw.file?.['mp3-128'];
    if (!streamUrl) continue;
    tracks.push({
      id: raw.track_id ?? null,
      title: raw.title ?? '',
      duration: raw.duration ?? 0,
      streamUrl,
    });
  }
  const startIndex = Math.max(
    0,
    tracks.findIndex((track) => track.id === featured),
  );
  return {
    matchKey: previewMatchKey(tralbum),
    tracks: tracks.map(({ id: _id, ...track }) => track),
    startIndex,
  };
}

/** The page's own key, or its album's for a track on one. */
function previewMatchKey({
  id,
  item_type: type,
  current,
}: {
  id?: number | null;
  item_type?: 'album' | 'track' | null;
  current?: { album_id?: number | null } | null;
}): ItemKey | null {
  if (id == null || type == null) return null;
  const albumId = type === 'track' ? current?.album_id : null;
  return albumId == null ? itemKey(type === 'album' ? 'a' : 't', id) : itemKey('a', albumId);
}

export async function fetchReleasePreview(
  fetchText: FetchText,
  url: string,
): Promise<ReleasePreview> {
  return parseReleasePreview(await fetchText(releasePageRequest(url)));
}
