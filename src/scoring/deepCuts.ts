// "Deep cuts": releases few people own but your closest crate mates do (decisions §18).
// score(α) = T × t/(t + c) × n^−β, only for n ≤ cap, where T is Σ score(F) over the top-K crate mates
// owning α, t how many own it and n Bandcamp's owner count. Pure: the eval grids β, c and the cap.

import { COMPILATION_FACTOR } from './compilations';
import { bestCrateMateRank, type CrateMateOwned } from './forYou';
import { DEEP_CUT_AGREEMENT, nichePenalty } from './weights';

export interface DeepCutOptions {
  /** Releases with more Bandcamp owners than this are left out (settings.deepCutMaxSupporters). */
  maxSupporters: number;
  /** Candidate popularity exponent. Defaults to DEEP_CUT_BETA. */
  beta?: number;
  /** Agreement shrink constant c. Defaults to DEEP_CUT_AGREEMENT. */
  agreement?: number;
}

/** What scoring needs from a candidate's item record. */
export interface DeepCutFacts {
  /** Bandcamp's owner count (`items.supporterCount`). Null: not a deep cut, never guessed. */
  supporterCount: number | null;
  /** A compilation to down-weight (§17). Callers pass false when the setting is off. */
  compilation: boolean;
}

export interface DeepCutCandidate extends CrateMateOwned {
  /** T × t/(t + c): the most it can score, known before any item lookup. */
  ceiling: number;
}

export interface DeepCutScored extends CrateMateOwned {
  /** Bandcamp's owner count, at least the crate mates owning it. */
  supporters: number;
  score: number;
}

/** The evidence term T × t/(t + c). n^−β ≤ 1, so it's also the score's ceiling. */
export function deepCutCeiling(candidate: CrateMateOwned, agreement = DEEP_CUT_AGREEMENT): number {
  return (candidate.crateMateScore * candidate.crateMates) / (candidate.crateMates + agreement);
}

/**
 * Scores a candidate, or null when it has no Bandcamp count or more owners than the cap. A
 * release has at least as many owners as crate mates owning it; the clamp guards a stale count.
 */
export function scoreDeepCut(
  candidate: CrateMateOwned,
  supporterCount: number | null,
  options: DeepCutOptions,
): DeepCutScored | null {
  if (supporterCount === null) return null;
  const supporters = Math.max(supporterCount, candidate.crateMates);
  if (supporters > options.maxSupporters) return null;
  const score =
    deepCutCeiling(candidate, options.agreement) * nichePenalty(supporters, options.beta);
  return { ...candidate, supporters, score };
}

/** Candidates with their ceilings, highest first, so pruning can stop at the first that can't rank. */
export function deepCutCandidates(
  owned: readonly CrateMateOwned[],
  agreement = DEEP_CUT_AGREEMENT,
): DeepCutCandidate[] {
  return owned
    .map((candidate) => ({ ...candidate, ceiling: deepCutCeiling(candidate, agreement) }))
    .sort((a, b) => b.ceiling - a.ceiling || b.crateMates - a.crateMates || a.id - b.id);
}

/** Whether a ceiling can still make the top `limit` of `top` (ranked). */
export function couldRankDeepCut(
  top: readonly DeepCutScored[],
  limit: number,
  ceiling: number,
): boolean {
  const last = top[limit - 1];
  return top.length < limit || last === undefined || ceiling >= last.score;
}

function byScore(a: DeepCutScored, b: DeepCutScored): number {
  return b.score - a.score || b.crateMates - a.crateMates || a.id - b.id;
}

/**
 * Scores `sorted` (deepCutCandidates order) into `top` until a ceiling can't make the top
 * `limit`; `done` then says no later candidate can either. Candidates `lookup` has no record for
 * can't be shown, so they take no place. Compilations keep COMPILATION_FACTOR of their score,
 * which only lowers it, so the ceilings stay valid.
 */
export function extendDeepCuts(
  top: readonly DeepCutScored[],
  sorted: readonly DeepCutCandidate[],
  lookup: (id: number) => DeepCutFacts | undefined,
  options: DeepCutOptions & { limit: number },
): { top: DeepCutScored[]; done: boolean } {
  const ranked = [...top];
  for (const candidate of sorted) {
    if (!couldRankDeepCut(ranked, options.limit, candidate.ceiling)) {
      return { top: ranked, done: true };
    }
    const { ceiling: _ceiling, ...owned } = candidate;
    const facts = lookup(owned.id);
    if (!facts) continue;
    const scored = scoreDeepCut(owned, facts.supporterCount, options);
    if (!scored) continue;
    const kept = facts.compilation
      ? { ...scored, score: scored.score * COMPILATION_FACTOR }
      : scored;
    // Insert in place: the list stays short (limit), and candidates arrive one at a time.
    let at = ranked.findIndex((other) => byScore(kept, other) < 0);
    if (at === -1) at = ranked.length;
    ranked.splice(at, 0, kept);
    if (ranked.length > options.limit) ranked.pop();
  }
  return { top: ranked, done: false };
}

/**
 * The best `limit` deep cuts among `owned` (crateMateOwnership's output), best first. `lookup` is
 * called only for candidates whose ceiling can still rank.
 */
export function rankDeepCuts(
  owned: readonly CrateMateOwned[],
  lookup: (id: number) => DeepCutFacts | undefined,
  options: DeepCutOptions & { limit: number },
): DeepCutScored[] {
  return extendDeepCuts([], deepCutCandidates(owned, options.agreement), lookup, options).top;
}

/** What the reason line needs: "Only 12 owners on Bandcamp · one is your #3 crate mate". */
export interface DeepCutReason {
  supporters: number;
  crateMates: number;
  /** 1-based rank of the most alike crate mate owning it, or null if none of `lists` holds it. */
  bestCrateMateRank: number | null;
}

export function deepCutReason(
  scored: Pick<DeepCutScored, 'id' | 'supporters' | 'crateMates'>,
  ranked: readonly (Float64Array | undefined)[],
): DeepCutReason {
  return {
    supporters: scored.supporters,
    crateMates: scored.crateMates,
    bestCrateMateRank: bestCrateMateRank(scored.id, ranked),
  };
}
