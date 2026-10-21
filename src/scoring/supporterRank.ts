// Orders a release's supporters by how much their collections are likely to tell you, before
// any of them is read (decisions §12). Pure: the repo gathers, the scanner applies the order.

/** Releases from the same seller or label count this much of a shared release. */
export const SAME_SELLER_BONUS = 0.5;

export interface PassZeroInput {
  /** Your collection's match ids. */
  mine: ReadonlySet<number>;
  /** Other releases from this release's seller or label, as match ids. */
  sellerCatalog: ReadonlySet<number>;
  /** w(i) for every id in `mine` and `sellerCatalog`. */
  weights: ReadonlyMap<number, number>;
  /** The release itself, which every supporter owns, so it says nothing. */
  release: number;
  /** In page order. `matchIds` is what we know they own so far, often only other supporter lists. */
  supporters: readonly { fanId: number; matchIds: ArrayLike<number> }[];
}

/**
 * Pass 0: Σ w(i) over releases they share with you, plus a bonus for other releases from the
 * same seller or label. Ties, including "nothing known", keep page order.
 */
export function passZeroOrder(input: PassZeroInput): number[] {
  const scored = input.supporters.map(({ fanId, matchIds }, position) => {
    let score = 0;
    for (let i = 0; i < matchIds.length; i++) {
      const id = matchIds[i] as number;
      if (id === input.release) continue;
      const w = input.weights.get(id) ?? 0;
      if (input.mine.has(id)) score += w;
      else if (input.sellerCatalog.has(id)) score += SAME_SELLER_BONUS * w;
    }
    return { fanId, score, position };
  });
  scored.sort((a, b) => b.score - a.score || a.position - b.position);
  return scored.map(({ fanId }) => fanId);
}

/**
 * Pass 1: Bandcamp's in-common count scaled by both collection sizes, count / √(yours · theirs),
 * so a fan who owns everything doesn't win on volume. 0 when either side is empty.
 */
export function inCommonSimilarity(inCommon: number, yours: number, theirs: number): number {
  return yours > 0 && theirs > 0 ? inCommon / Math.sqrt(yours * theirs) : 0;
}

/**
 * Whether a profiled fan's collection should be read before the profiles still waiting: a
 * similarity of at least half the best among this release's profiled supporters so far.
 */
export function readsAhead(similarity: number, best: number): boolean {
  return similarity > 0 && similarity >= best / 2;
}
