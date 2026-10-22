// The methods compared, each a ranking of the same candidates. Pure.

import { rankForYou, scoreForYou } from '../../src/scoring/forYou';
import { rankDeepCuts } from './deepCutsAdapter';
import type { Candidate, MethodSpec } from './types';

export const FOR_YOU_TWINS = 30;
/** Deep cuts draws on more twins, as decisions §18 sets. */
export const DEEP_CUT_TWINS = 100;
export const BETAS = [0.3, 0.45, 0.6, 0.8] as const;
export const AGREEMENTS = [0, 1, 2, 4] as const;
export const CAPS = [25, 50, 100] as const;

/** For you's own order: twinScore × w(n), with the local count as fallback like the worker. */
function forYouOrder(candidates: readonly Candidate[], limit: number): Candidate[] {
  const byId = new Map(candidates.map((c) => [c.id, c]));
  const scored = candidates.map((c) => scoreForYou(c, c.supporters ?? c.owners));
  return rankForYou(scored, limit).flatMap((s) => byId.get(s.id) ?? []);
}

export function buildMethods(): MethodSpec[] {
  const methods: MethodSpec[] = [
    {
      kind: 'popularity',
      label: 'Popularity (rank by T)',
      twinsK: FOR_YOU_TWINS,
      cap: null,
      // twinOwnership already returns highest twin score first.
      rank: (candidates, limit) => candidates.slice(0, limit),
    },
    {
      kind: 'forYou',
      label: 'For you',
      twinsK: FOR_YOU_TWINS,
      cap: null,
      rank: forYouOrder,
    },
  ];
  for (const cap of CAPS) {
    methods.push({
      kind: 'edge',
      label: `Edge n≤${cap}`,
      twinsK: FOR_YOU_TWINS,
      cap,
      rank: (candidates, limit) =>
        forYouOrder(
          candidates.filter((c) => c.supporters !== null && c.supporters <= cap),
          limit,
        ),
    });
  }
  for (const cap of CAPS) {
    for (const beta of BETAS) {
      for (const agreement of AGREEMENTS) {
        methods.push({
          kind: 'deepCuts',
          label: `Deep cuts β=${beta} c=${agreement} n≤${cap}`,
          twinsK: DEEP_CUT_TWINS,
          cap,
          rank: (candidates, limit) => rankDeepCuts(candidates, { cap, beta, agreement }, limit),
        });
      }
    }
  }
  return methods;
}
