// Runs every method on one fold's candidates. Pure.

import { listMetrics } from './metrics';
import { CAPS } from './methods';
import {
  KS,
  type Candidate,
  type FoldRow,
  type K,
  type ListMetrics,
  type MethodSpec,
  type Popularity,
} from './types';

const LIST_SIZE = Math.max(...KS);

/**
 * `candidatesByCrateMatesK` holds the candidates built from each K the methods ask for. Methods
 * without a cap of their own are scored at every cap in the grid, so each can be compared with
 * the capped methods on the same niche definition.
 */
export function evaluateFold(
  methods: readonly MethodSpec[],
  candidatesByCrateMatesK: ReadonlyMap<number, readonly Candidate[]>,
  heldOut: ReadonlySet<number>,
  popularity: (id: number) => Popularity,
): FoldRow[] {
  return methods.flatMap((method) => {
    const candidates = candidatesByCrateMatesK.get(method.crateMatesK) ?? [];
    const ranked = method.rank(candidates, LIST_SIZE);
    return (method.cap === null ? CAPS : [method.cap]).map((nicheCap) => {
      const at = Object.fromEntries(
        KS.map((k) => [k, listMetrics(ranked, heldOut, popularity, nicheCap, k)]),
      ) as Record<K, ListMetrics>;
      return { kind: method.kind, label: method.label, nicheCap, at };
    });
  });
}
