// The selling account of a release we can't fetch the page of (a custom domain, decisions §5).

import type { ItemKey } from '../bandcamp';
import { type CraterDb, getItemList, itemsAtUrls } from '../db';

/**
 * The stored `bandId` of the first of `itemKeys` we know, else of the item at `url` (a track of
 * the album wanted is sold by the same account). Null when we know neither.
 */
export async function sellerOf(
  db: CraterDb,
  url: string,
  itemKeys: readonly ItemKey[],
): Promise<number | null> {
  const known = (await getItemList(db, itemKeys)).find((item) => item !== undefined);
  if (known) return known.bandId;
  const atUrl = (await itemsAtUrls(db, [url])).find((item) => item.url === url);
  return atUrl?.bandId ?? null;
}
