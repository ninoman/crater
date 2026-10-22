// The one place the eval calls Deep cuts. TODO: after merging deep-cuts-core, replace this body
// with rankDeepCuts from src/scoring/deepCuts.ts (same options: cap, beta, agreement).
// Until then it follows the formula in docs/research/deep-cuts.md.

import type { Candidate, DeepCutParams } from './types';

/**
 * score = T × t/(t + c) × n^−β over releases with n ≤ cap, n = max(Bandcamp count, t).
 * Releases without a Bandcamp count are left out, not scored on local owners.
 */
export function rankDeepCuts(
  candidates: readonly Candidate[],
  { cap, beta, agreement }: DeepCutParams,
): Candidate[] {
  const scored = candidates.flatMap((c) => {
    if (c.supporters === null) return [];
    const n = Math.max(c.supporters, c.twins);
    if (n > cap) return [];
    return [{ c, score: c.twinScore * (c.twins / (c.twins + agreement)) * n ** -beta }];
  });
  return scored
    .sort((a, b) => b.score - a.score || b.c.twins - a.c.twins || a.c.id - b.c.id)
    .map((s) => s.c);
}
