// For you's Fresh mode (decisions §11): what your lately crate mates bought in the last year, each
// purchase weighed by how in step that crate mate is with you lately and by how much it has faded.
// Pure: the candidates feed the same scoring, pruning and diversity steps as All time.

import { byCrateMateScore, type CrateMateOwned } from './forYou';
import { fade, TREND_LOOKBACK_MS } from './lately';

/** A lately crate mate with their `fanMatches` list and its purchase times. */
export interface LatelyCrateMateMatches {
  /** Their lately score. */
  score: number;
  matches: Float64Array;
  /** Newest purchase time under each of `matches`, in the same order. 0 when unknown. */
  times: Float64Array;
}

export interface FreshOwned extends CrateMateOwned {
  /** The newest purchase of it among the crate mates, for "latest 3 days ago". */
  lastBoughtAt: number;
}

/**
 * Sums lately score × fade(purchase) per match id, counting only purchases from the last year
 * and dropping excluded ids. Fade ≤ 1, so crateMateScore is still the score's ceiling. Undated
 * purchases count as old, so they're left out. Highest crateMateScore first.
 */
export function freshOwnership(
  crateMates: readonly LatelyCrateMateMatches[],
  excluded: ReadonlySet<number>,
  now: number,
  halfLifeMs: number,
): FreshOwned[] {
  const since = now - TREND_LOOKBACK_MS;
  const byId = new Map<number, FreshOwned>();
  for (const crateMate of crateMates) {
    crateMate.matches.forEach((id, j) => {
      const time = crateMate.times[j] ?? 0;
      if (time < since || excluded.has(id)) return;
      const faded = fade(time, now, halfLifeMs);
      if (faded === 0) return;
      const entry = byId.get(id);
      if (entry) {
        entry.crateMateScore += crateMate.score * faded;
        entry.crateMates++;
        entry.lastBoughtAt = Math.max(entry.lastBoughtAt, time);
      } else
        byId.set(id, {
          id,
          crateMateScore: crateMate.score * faded,
          crateMates: 1,
          lastBoughtAt: time,
        });
    });
  }
  return [...byId.values()].sort(byCrateMateScore);
}
