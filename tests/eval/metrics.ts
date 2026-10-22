// Metrics for one ranked list against the held-out releases. Pure.

import type { Candidate, ListMetrics, Popularity } from './types';

/** What a release's popularity counts as: Bandcamp's count, else the owners we've seen. */
export function popularityOf(pop: Popularity): number {
  return pop.supporters ?? pop.owners;
}

/** A release is niche only when Bandcamp's own count says so: we don't guess from local owners. */
export function isNiche(pop: Popularity, cap: number): boolean {
  return pop.supporters !== null && pop.supporters <= cap;
}

export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2
    ? (sorted[mid] as number)
    : ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
}

/**
 * Metrics for the first `k` of `ranked`. `popularity` must cover every held-out id and every
 * ranked one. Recall counts hits over all held-out releases; niche recall over those with n ≤ cap.
 */
export function listMetrics(
  ranked: readonly Candidate[],
  heldOut: ReadonlySet<number>,
  popularity: (id: number) => Popularity,
  nicheCap: number,
  k: number,
): ListMetrics {
  const list = ranked.slice(0, k);
  const hits = list.filter((c) => heldOut.has(c.id));
  const nicheHeld = [...heldOut].filter((id) => isNiche(popularity(id), nicheCap));
  const nicheHits = hits.filter((c) => isNiche(popularity(c.id), nicheCap));
  const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;
  return {
    recall: heldOut.size === 0 ? 0 : hits.length / heldOut.size,
    nicheRecall: nicheHeld.length === 0 ? null : nicheHits.length / nicheHeld.length,
    arp:
      list.length === 0
        ? null
        : mean(list.map((c) => Math.log2(1 + popularityOf(popularity(c.id))))),
    medianHitN: median(hits.map((c) => popularityOf(popularity(c.id)))),
    singleTwinShare:
      list.length === 0 ? null : list.filter((c) => c.twins === 1).length / list.length,
  };
}
