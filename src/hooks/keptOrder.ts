// Keeps a list's rows where they are across re-scores, so nothing jumps under the pointer. The
// latest ranking is applied only when asked for.

import type { ItemKey } from '../bandcamp';

type Keyed = { matchKey: ItemKey };

/** `next`'s rows: the ones already shown keep their places, new ones follow in rank order. */
export function keepOrder<R extends Keyed>(shown: readonly R[], next: readonly R[]): R[] {
  const place = new Map(shown.map((row, i) => [row.matchKey, i]));
  const kept = next.filter((row) => place.has(row.matchKey));
  kept.sort((a, b) => (place.get(a.matchKey) ?? 0) - (place.get(b.matchKey) ?? 0));
  return [...kept, ...next.filter((row) => !place.has(row.matchKey))];
}

/** The rows sorted by `ranked`, best first. Rows it doesn't list go last. */
export function inRankOrder<R extends Keyed>(rows: readonly R[], ranked: readonly ItemKey[]): R[] {
  const rank = new Map(ranked.map((key, i) => [key, i]));
  const at = (row: R) => rank.get(row.matchKey) ?? ranked.length;
  return [...rows].sort((a, b) => at(a) - at(b));
}

/** Whether the rows sit in a different order than `ranked` puts them. */
export function isOutOfOrder(rows: readonly Keyed[], ranked: readonly ItemKey[]): boolean {
  const sorted = inRankOrder(rows, ranked);
  return rows.some((row, i) => row !== sorted[i]);
}
