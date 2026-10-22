// A fan's newest purchases, from their match lists. Pure.

import type { TwinPurchases } from './twinsLatest';

export interface RecentBuy {
  /** Match id (keyToNumber of the matchKey). */
  id: number;
  boughtAt: number;
}

/** Up to `limit` releases, newest first. Releases with no known purchase time are left out. */
export function recentBuys(
  { matchIds, matchTimes }: Omit<TwinPurchases, 'fanId'>,
  limit: number,
): RecentBuy[] {
  const buys: RecentBuy[] = [];
  matchIds.forEach((id, i) => {
    const boughtAt = matchTimes[i] ?? 0;
    if (boughtAt > 0) buys.push({ id, boughtAt });
  });
  return buys.sort((a, b) => b.boughtAt - a.boughtAt || a.id - b.id).slice(0, limit);
}
