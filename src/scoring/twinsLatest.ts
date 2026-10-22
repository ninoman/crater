// What your twins bought lately that you don't own, newest first (decisions §11). Pure, over
// each twin's match lists.

/** One twin's distinct releases and the newest purchase time under each (0 when unknown). */
export interface TwinPurchases {
  fanId: number;
  matchIds: Float64Array;
  matchTimes: Float64Array;
}

export interface LatestPick {
  /** Match id (keyToNumber of the matchKey). */
  id: number;
  /** The newest purchase among the twins who bought it. */
  boughtAt: number;
  /** Who bought it since the cut-off, in the order the twins were given. */
  fanIds: number[];
}

/**
 * Releases bought at or after `since` by any of `twins`, leaving out `excluded`. Newest first;
 * a tie goes to the release more twins bought.
 */
export function latestPurchases(
  twins: readonly TwinPurchases[],
  excluded: ReadonlySet<number>,
  since: number,
): LatestPick[] {
  const picks = new Map<number, LatestPick>();
  for (const { fanId, matchIds, matchTimes } of twins) {
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
export function feedTwins(boards: readonly (readonly number[])[], k: number): number[] {
  return [...new Set(boards.flatMap((board) => board.slice(0, k)))];
}
