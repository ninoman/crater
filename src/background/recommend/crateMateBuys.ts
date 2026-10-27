// What each crate mate bought last, dressed for the covers on the leaderboard.

import { artUrl, keyFromNumber, type ItemKey } from '../../bandcamp';
import { getDisplayItems, getPurchaseLists, type CraterDb } from '../../db';
import { recentBuys } from '../../scoring/recentBuys';
import type { CrateMateBuy } from '../../shared/crateMates';

/** Covers per crate mate on the leaderboard. */
export const CRATE_MATE_BUYS = 6;

/** Each fan's newest purchases that have an item record to show, newest first. */
export async function readCrateMateBuys(
  db: CraterDb,
  fanIds: readonly number[],
): Promise<Map<number, CrateMateBuy[]>> {
  const lists = await getPurchaseLists(db, fanIds);
  // Purchases with no item record can't be shown; pick a few spare in case.
  const picks = new Map(lists.map((list) => [list.fanId, recentBuys(list, CRATE_MATE_BUYS * 2)]));
  const keys = new Set<ItemKey>();
  for (const buys of picks.values()) for (const buy of buys) keys.add(keyFromNumber(buy.id));
  const items = await getDisplayItems(db, [...keys]);

  const result = new Map<number, CrateMateBuy[]>();
  for (const [fanId, buys] of picks) {
    const shown = buys.flatMap((buy): CrateMateBuy[] => {
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
    result.set(fanId, shown.slice(0, CRATE_MATE_BUYS));
  }
  return result;
}
