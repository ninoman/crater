// Rarity weights: owning a rare release says more about taste than owning a hit.

/**
 * supporters(i): the first count Bandcamp gave us (also_collected_count + 1, album before track,
 * decisions §3.2 and §3.8), else the owners we've seen ourselves.
 */
export function supporters(
  bandcampCounts: readonly (number | null | undefined)[],
  knownOwners: number,
): number {
  for (const count of bandcampCounts) if (count != null) return count;
  return knownOwners;
}

/** w(i) = 1 / log2(2 + supporters(i)). 1 for an item nobody else owns, falling slowly after. */
export function weight(supporterCount: number): number {
  return 1 / Math.log2(2 + Math.max(0, supporterCount));
}
