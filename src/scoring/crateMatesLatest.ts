// What your crate mates bought lately that you don't own, newest first (decisions §11). Pure, over
// each crate mate's match lists.

/** One crate mate's distinct releases and the newest purchase time under each (0 when unknown). */
export interface CrateMatePurchases {
  fanId: number;
  matchIds: Float64Array;
  matchTimes: Float64Array;
}

export interface LatestPick {
  /** Match id (keyToNumber of the matchKey). */
  id: number;
  /** The newest purchase among the crate mates who bought it. */
  boughtAt: number;
  /** Who bought it since the cut-off, in the order the crate mates were given. */
  fanIds: number[];
}

/**
 * Releases bought at or after `since` by any of `crateMates`, leaving out `excluded`. Newest first;
 * a tie goes to the release more crate mates bought.
 */
export function latestPurchases(
  crateMates: readonly CrateMatePurchases[],
  excluded: ReadonlySet<number>,
  since: number,
): LatestPick[] {
  const picks = new Map<number, LatestPick>();
  for (const { fanId, matchIds, matchTimes } of crateMates) {
    matchIds.forEach((id, i) => {
      const at = matchTimes[i] ?? 0;
      if (at < since || excluded.has(id)) return;
      const pick = picks.get(id);
      if (!pick) picks.set(id, { id, boughtAt: at, fanIds: [fanId] });
      else {
        pick.boughtAt = Math.max(pick.boughtAt, at);
        pick.fanIds.push(fanId);
      }
    });
  }
  return [...picks.values()].sort(
    (a, b) => b.boughtAt - a.boughtAt || b.fanIds.length - a.fanIds.length || a.id - b.id,
  );
}

/** Each board's top `k`, the first board first, without repeats. */
export function feedCrateMates(boards: readonly (readonly number[])[], k: number): number[] {
  return [...new Set(boards.flatMap((board) => board.slice(0, k)))];
}
