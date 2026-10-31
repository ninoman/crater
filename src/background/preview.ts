// Reads a release's preview tracks: from its page, or the mobile API on a custom domain (§5).

import {
  fetchApiReleasePreview,
  fetchReleasePreview,
  isBandcampUrl,
  type FetchJson,
  type FetchText,
  type ReleasePreview,
} from '../bandcamp';
import { itemsAtUrls, type CraterDb } from '../db';
import { BlockedHostError } from './http';

export async function getReleasePreview(
  db: CraterDb,
  { fetchJson, fetchText }: { fetchJson: FetchJson; fetchText: FetchText },
  url: string,
): Promise<ReleasePreview> {
  if (isBandcampUrl(url)) return fetchReleasePreview(fetchText, url);
  const item = (await itemsAtUrls(db, [url])).find((candidate) => candidate.url === url);
  if (!item) throw new BlockedHostError(url, 'its seller is unknown');
  return fetchApiReleasePreview(fetchJson, item.bandId, item.itemKey);
}
