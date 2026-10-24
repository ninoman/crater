// "Crate mates who own it" for a list of releases you don't (yet) own, such as your wishlist:
// how many of your top crate mates hold each one. Pure; src/background gathers the lists
// (decisions §24).

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
 * For each match id, in order: how many of the crate mates' collections hold it. Each list must
 * be sorted ascending, as `fanMatches.matchIds` is.
 */
export function crateMateOwnerCounts(
  matchIds: readonly number[],
  crateMateMatches: readonly Float64Array[],
): number[] {
  return matchIds.map((id) => crateMateMatches.filter((matches) => includes(matches, id)).length);
}
