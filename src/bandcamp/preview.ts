import { ParserError } from './errors';
import { readDataAttribute } from './html';
import type { FetchText } from './release';
import { releasePageRequest } from './requests';
import { rawTralbumTracks } from './schemas';
import type { PreviewTrack, ReleasePreview } from './types';
import { validate } from './validate';

/** Reads the streamable tracks from an album or track page's `data-tralbum`. */
export function parseReleasePreview(html: string): ReleasePreview {
  const json = readDataAttribute(html, 'tralbum');
  if (json === null) throw new ParserError('release page', 'no data-tralbum attribute');
  const { featured_track_id: featured, trackinfo } = validate(
    rawTralbumTracks,
    json,
    'data-tralbum',
  );

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
  return { tracks: tracks.map(({ id: _id, ...track }) => track), startIndex };
}

export async function fetchReleasePreview(
  fetchText: FetchText,
  url: string,
): Promise<ReleasePreview> {
  return parseReleasePreview(await fetchText(releasePageRequest(url)));
}
