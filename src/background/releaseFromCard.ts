import {
  type FanItemCard,
  type FetchJson,
  fetchReleaseDetails,
  type ReleaseInfo,
} from '../bandcamp';
import { type CraterDb, getItem, putItems } from '../db';

/**
 * The release behind an item card, saved to `items` if it's new, so your wishlist can list it
 * before the next sync. The card doesn't say which album a track is on; without an answer from
 * Bandcamp it counts as standalone until that sync (decisions §21).
 */
export async function releaseFromCard(
  db: CraterDb,
  fetchJson: FetchJson,
  card: FanItemCard,
): Promise<Pick<ReleaseInfo, 'itemKey' | 'albumKey'>> {
  const known = await getItem(db, card.itemKey);
  if (known) return known;

  const details = await fetchReleaseDetails(fetchJson, card.bandId, card.itemKey).catch(
    (error: unknown) => {
      console.warn('crater: no release details for a wishlisted card', error);
      return null;
    },
  );
  const item = {
    itemKey: card.itemKey,
    albumKey: details?.albumKey ?? null,
    title: card.title,
    artist: card.artist,
    bandId: card.bandId,
    label: null,
    labelId: null,
    url: details?.url ?? card.url,
    artId: card.artId,
    tags: [],
    supporterCount: null,
    compilation: false,
  };
  await putItems(db, [item]);
  return item;
}
