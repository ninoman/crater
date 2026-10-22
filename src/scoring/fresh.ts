// For you's Fresh mode (decisions §11): what your lately twins bought in the last year, each
// purchase weighed by how in step that twin is with you lately and by how much it has faded.
// Pure: the candidates feed the same scoring, pruning and diversity steps as All time.

import { byTwinScore, type TwinOwned } from './forYou';
import { fade, TREND_LOOKBACK_MS } from './lately';

/** A lately twin with their `fanMatches` list and its purchase times. */
export interface LatelyTwinMatches {
  /** Their lately score. */
  score: number;
  matches: Float64Array;
  /** Newest purchase time under each of `matches`, in the same order. 0 when unknown. */
  times: Float64Array;
}

export interface FreshOwned extends TwinOwned {
  /** The newest purchase of it among the twins, for "latest 3 days ago". */
  lastBoughtAt: number;
}

/**
 * Sums lately score × fade(purchase) per match id, counting only purchases from the last year
 * and dropping excluded ids. Fade ≤ 1, so twinScore is still the score's ceiling. Undated
 * purchases count as old, so they're left out. Highest twinScore first.
 */
export function freshOwnership(
  twins: readonly LatelyTwinMatches[],
  excluded: ReadonlySet<number>,
  now: number,
  halfLifeMs: number,
): FreshOwned[] {
  const since = now - TREND_LOOKBACK_MS;
  const byId = new Map<number, FreshOwned>();
  for (const twin of twins) {
    twin.matches.forEach((id, j) => {
      const time = twin.times[j] ?? 0;
      if (time < since || excluded.has(id)) return;
      const faded = fade(time, now, halfLifeMs);
      if (faded === 0) return;
      const entry = byId.get(id);
      if (entry) {
        entry.twinScore += twin.score * faded;
        entry.twins++;
        entry.lastBoughtAt = Math.max(entry.lastBoughtAt, time);
      } else byId.set(id, { id, twinScore: twin.score * faded, twins: 1, lastBoughtAt: time });
    });
  }
  return [...byId.values()].sort(byTwinScore);
}
