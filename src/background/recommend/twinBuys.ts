// What each twin bought last, dressed for the covers on the leaderboard.

import { artUrl, keyFromNumber, type ItemKey } from '../../bandcamp';
import { getDisplayItems, getPurchaseLists, type DigheadDb } from '../../db';
import { recentBuys } from '../../scoring/recentBuys';
import type { TwinBuy } from '../../shared/twins';

/** Covers per twin on the leaderboard. */
export const TWIN_BUYS = 6;

/** Each fan's newest purchases that have an item record to show, newest first. */
export async function readTwinBuys(
  db: DigheadDb,
  fanIds: readonly number[],
): Promise<Map<number, TwinBuy[]>> {
  const lists = await getPurchaseLists(db, fanIds);
  // Purchases with no item record can't be shown; pick a few spare in case.
  const picks = new Map(lists.map((list) => [list.fanId, recentBuys(list, TWIN_BUYS * 2)]));
  const keys = new Set<ItemKey>();
  for (const buys of picks.values()) for (const buy of buys) keys.add(keyFromNumber(buy.id));
  const items = await getDisplayItems(db, [...keys]);

  const result = new Map<number, TwinBuy[]>();
  for (const [fanId, buys] of picks) {
    const shown = buys.flatMap((buy): TwinBuy[] => {
      const matchKey = keyFromNumber(buy.id);
      const item = items.get(matchKey);
      if (!item) return [];
      return [
        {
          matchKey,
          title: item.title,
          artist: item.artist,
          url: item.url,
          coverUrl: item.artId === null ? null : artUrl(item.artId),
          boughtAt: buy.boughtAt,
        },
      ];
    });
    result.set(fanId, shown.slice(0, TWIN_BUYS));
  }
  return result;
}
