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

/** Deep cuts: crate mates drawn on. More than For you's K, since niche picks are spread thin. */
export const DEEP_CUT_CRATE_MATES_K = 100;
/** Candidate popularity penalty n^−β. 0.6: RP³β's default, and Zhou et al.'s tuned λ on RYM. */
export const DEEP_CUT_BETA = 0.6;
/** Agreement shrink t/(t + c): one crate mate alone counts 1/3, two 1/2, four 2/3. */
export const DEEP_CUT_AGREEMENT = 2;

/** n^−β for a release's Bandcamp owner count. 1 for a release only one fan owns. */
export function nichePenalty(supporterCount: number, beta = DEEP_CUT_BETA): number {
  return Math.max(1, supporterCount) ** -beta;
}
