// The one place the eval calls Deep cuts: maps its candidates onto the real scorer.

import { rankDeepCuts as rankReal } from '../../src/scoring/deepCuts';
import type { Candidate, DeepCutParams } from './types';

/**
 * The best `limit` deep cuts among `candidates`, best first. Compilations aren't down-weighted
 * in the eval (see report.ts), so every lookup says not a compilation.
 */
export function rankDeepCuts(
  candidates: readonly Candidate[],
  { cap, beta, agreement }: DeepCutParams,
  limit: number,
): Candidate[] {
  const byId = new Map(candidates.map((c) => [c.id, c]));
  const lookup = (id: number) => {
    const c = byId.get(id);
    return c && { supporterCount: c.supporters, compilation: false };
  };
  return rankReal(candidates, lookup, { maxSupporters: cap, beta, agreement, limit }).flatMap(
    (s) => byId.get(s.id) ?? [],
  );
}
