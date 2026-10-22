// Your followings as a nudge (decisions §15): releases from accounts you follow score a little
// higher, and supporters you follow are read first. Pure: src/db gathers, src/background applies.

/** Releases from an account you follow score up to ×(1 + FOLLOW_BOOST). Below the twin boost. */
export const FOLLOW_BOOST = 0.25;

/** A release's selling account and label, as `items` stores them. */
export interface ReleaseSeller {
  /** The release, as keyToNumber(matchKey). */
  id: number;
  bandId: number;
  labelId: number | null;
}

/**
 * Per release, the name of the band account you follow behind it: its seller, else its label.
 * Releases with neither followed are left out. A release with several records (an album and
 * its tracks) counts when any of them does; the first one found names it.
 */
export function followedReleases(
  releases: readonly ReleaseSeller[],
  followedBands: ReadonlyMap<number, string>,
): Map<number, string> {
  const result = new Map<number, string>();
  for (const { id, bandId, labelId } of releases) {
    if (result.has(id)) continue;
    const name =
      followedBands.get(bandId) ?? (labelId === null ? undefined : followedBands.get(labelId));
    if (name !== undefined) result.set(id, name);
  }
  return result;
}

/** The multiplier for a release: ×(1 + FOLLOW_BOOST) when followed, else 1. */
export function followFactor(followed: boolean): number {
  return followed ? 1 + FOLLOW_BOOST : 1;
}

/**
 * The most any candidate's score can grow by. Pruning multiplies its ceilings by this, so a
 * boosted release below the cut-off is never skipped.
 */
export function maxFollowFactor(followed: ReadonlyMap<number, string>): number {
  return followFactor(followed.size > 0);
}

/** Multiplies the score of each followed release. Ranking is left to the caller. */
export function boostFollowed<T extends { id: number; score: number }>(
  scored: readonly T[],
  followed: ReadonlyMap<number, string>,
): T[] {
  return scored.map((s) =>
    followed.has(s.id) ? { ...s, score: s.score * followFactor(true) } : s,
  );
}

/** Supporters you follow move to the front, each group keeping its order. */
export function followedFirst(
  order: readonly number[],
  followedFans: ReadonlySet<number>,
): number[] {
  return [
    ...order.filter((fanId) => followedFans.has(fanId)),
    ...order.filter((fanId) => !followedFans.has(fanId)),
  ];
}
