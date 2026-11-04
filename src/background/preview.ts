// Reads a release's preview tracks: from its page, or the mobile API on a custom domain (§5).

import {
  fetchApiReleasePreview,
  fetchReleasePreview,
  isBandcampUrl,
  type FetchJson,
  type FetchText,
  type ReleasePreview,
} from '../bandcamp';
import { itemsAtUrls, trackBuyerCounts, type CraterDb } from '../db';
import { previewStartIndex } from '../scoring/previewStart';
import { BlockedHostError } from './http';

/** The release's preview, starting at the track fans bought most on its own (§22). */
export async function getReleasePreview(
  db: CraterDb,
  fetchers: { fetchJson: FetchJson; fetchText: FetchText },
  url: string,
): Promise<ReleasePreview> {
  const preview = await fetchPreview(db, fetchers, url);
  if (preview.matchKey === null || preview.tracks.length < 2) return preview;
  const buyers = await trackBuyerCounts(db, preview.matchKey);
  return { ...preview, startIndex: previewStartIndex(preview.tracks, buyers, preview.startIndex) };
}

async function fetchPreview(
  db: CraterDb,
  { fetchJson, fetchText }: { fetchJson: FetchJson; fetchText: FetchText },
  url: string,
): Promise<ReleasePreview> {
  if (isBandcampUrl(url)) return fetchReleasePreview(fetchText, url);
  const item = (await itemsAtUrls(db, [url])).find((candidate) => candidate.url === url);
  if (!item) throw new BlockedHostError(url, 'its seller is unknown');
  return fetchApiReleasePreview(fetchJson, item.bandId, item.itemKey);
}
