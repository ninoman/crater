// What ignoring compilations means for each scorer (decisions §17). Pure: callers pass the match
// ids flagged as compilations, or an empty set when the setting is off.

import type { SharedPosition } from './lately';

/** A compilation recommended by Also bought or For you keeps this share of its score. */
export const COMPILATION_FACTOR = 0.5;

/**
 * Twin overlap without compilations: they connect fans through their artist lists, not taste,
 * so they're dropped before anything is counted.
 */
export function withoutCompilations(
  shared: readonly SharedPosition[],
  mine: Float64Array,
  compilations: ReadonlySet<number>,
): SharedPosition[] {
  if (compilations.size === 0) return [...shared];
  return shared.filter((at) => !compilations.has(mine[at.mine] as number));
}

/**
 * Scales compilations among recommendation candidates down by COMPILATION_FACTOR. Only lowers
 * scores, so score ceilings used for pruning stay valid.
 */
export function discountCompilations<T extends { id: number; score: number }>(
  scored: readonly T[],
  compilations: ReadonlySet<number>,
): T[] {
  return scored.map((candidate) =>
    compilations.has(candidate.id)
      ? { ...candidate, score: candidate.score * COMPILATION_FACTOR }
      : candidate,
  );
}
