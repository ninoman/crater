// "Crate mates who own it" for a list of releases you don't (yet) own, such as your wishlist:
// how many of your top crate mates hold each one, and how alike those crate mates are. Pure;
// src/background gathers the lists (decisions §22).

import type { CrateMateMatches } from './forYou';

export interface OwnedByCrateMates {
  /** How many of the crate mates own it. */
  owners: number;
  /** Σ score of those crate mates, to break ties between equal counts. */
  score: number;
}

/** Whether a sorted list holds `id`. */
function includes(sorted: Float64Array, id: number): boolean {
  let low = 0;
  let high = sorted.length - 1;
  while (low <= high) {
    const mid = (low + high) >>> 1;
    const value = sorted[mid] as number;
    if (value === id) return true;
    if (value < id) low = mid + 1;
    else high = mid - 1;
  }
  return false;
}

/**
 * For each match id, in order: the crate mates whose collection holds it. `matches` must be
 * sorted ascending, as `fanMatches.matchIds` is.
 */
export function crateMateOwnerCounts(
  matchIds: readonly number[],
  crateMates: readonly CrateMateMatches[],
): OwnedByCrateMates[] {
  return matchIds.map((id) => {
    const owners = crateMates.filter((crateMate) => includes(crateMate.matches, id));
    return { owners: owners.length, score: owners.reduce((sum, c) => sum + c.score, 0) };
  });
}
