// "For you": what your top crate mates own, weighted by how alike each crate mate is and by rarity.
// score(i) = Σ over top-K crate mates F owning i of score(F) × w(i). Pure: src/db gathers the data
// and src/background runs the steps.

import { keyFromNumber, type ItemKey } from '../bandcamp';
import { weight } from './weights';

export const FOR_YOU_LIMIT = 30;
/** Diversity rule: at most this many releases per artist in the first DIVERSE_ROWS rows. */
export const MAX_PER_ARTIST = 2;
export const DIVERSE_ROWS = 20;

export interface CrateMate {
  fanId: number;
  score: number;
}

/** A top crate mate with their distinct collection match ids (a `fanMatches` list). */
export interface CrateMateMatches {
  score: number;
  matches: Float64Array;
}

/** The K most alike crate mates. Ties break on fanId, so the same data always picks the same crate mates. */
export function topCrateMates<T extends CrateMate>(crateMates: readonly T[], k: number): T[] {
  return [...crateMates].sort((a, b) => b.score - a.score || a.fanId - b.fanId).slice(0, k);
}

export interface CrateMateOwned {
  /** The release, as keyToNumber(matchKey). */
  id: number;
  /** Σ score(F) over the crate mates owning it. w(i) ≤ 1, so this is also the score's ceiling. */
  crateMateScore: number;
  /** How many of the crate mates own it, for "owned by N of your top crate mates". */
  crateMates: number;
}

/**
 * Sums crate mate scores per match id across the crate mates' lists (each holds distinct ids, so tracks of
 * an album already count once per crate mate) and drops excluded ids. Highest crateMateScore first.
 */
export function crateMateOwnership(
  crateMates: readonly CrateMateMatches[],
  excluded: ReadonlySet<number>,
): CrateMateOwned[] {
  const byId = new Map<number, CrateMateOwned>();
  for (const crateMate of crateMates) {
    for (const id of crateMate.matches) {
      if (excluded.has(id)) continue;
      const entry = byId.get(id);
      if (entry) {
        entry.crateMateScore += crateMate.score;
        entry.crateMates++;
      } else byId.set(id, { id, crateMateScore: crateMate.score, crateMates: 1 });
    }
  }
  return [...byId.values()].sort(byCrateMateScore);
}

/** Candidate order for pruning: highest crateMateScore first, then most crate mates, then id. */
export function byCrateMateScore(a: CrateMateOwned, b: CrateMateOwned): number {
  return b.crateMateScore - a.crateMateScore || b.crateMates - a.crateMates || a.id - b.id;
}

export interface ForYouScored extends CrateMateOwned {
  supporters: number;
  score: number;
}

/**
 * score = crateMateScore × w(supporters). A release has at least as many supporters as crate mates owning
 * it; the clamp guards a stale Bandcamp count.
 */
export function scoreForYou(candidate: CrateMateOwned, supporterCount: number): ForYouScored {
  const count = Math.max(supporterCount, candidate.crateMates);
  return { ...candidate, supporters: count, score: candidate.crateMateScore * weight(count) };
}

/** Best first. Ties break on crate mates, then id. */
export function rankForYou(scored: readonly ForYouScored[], limit: number): ForYouScored[] {
  return [...scored]
    .sort((a, b) => b.score - a.score || b.crateMates - a.crateMates || a.id - b.id)
    .slice(0, limit);
}

/**
 * At most MAX_PER_ARTIST releases per artist in the first DIVERSE_ROWS rows. Extras move down
 * just past those rows, still in rank order. Releases with no known artist are never held back,
 * and if too few other artists are left, the extras fill in rather than leave rows empty.
 */
export function diversify<T extends { id: number }>(
  ranked: readonly T[],
  artists: ReadonlyMap<number, string>,
): T[] {
  const front: T[] = [];
  const rest: T[] = [];
  const counts = new Map<string, number>();
  for (const item of ranked) {
    const artist = artists.get(item.id)?.trim().toLowerCase();
    const seen = artist === undefined ? 0 : (counts.get(artist) ?? 0);
    if (front.length < DIVERSE_ROWS && seen < MAX_PER_ARTIST) {
      front.push(item);
      if (artist !== undefined) counts.set(artist, seen + 1);
    } else rest.push(item);
  }
  return [...front, ...rest];
}

export interface ForYouPick {
  matchKey: ItemKey;
  /** Crate mates owning it, for the reason line. */
  crateMates: number;
}

/**
 * Diversifies the ranked list and keeps the first `limit`. Rank more than `limit` beforehand,
 * so moved-down extras leave room for other artists to come up.
 */
export function forYouPicks(
  ranked: readonly ForYouScored[],
  artists: ReadonlyMap<number, string>,
  limit: number,
): ForYouPick[] {
  return diversify(ranked, artists)
    .slice(0, limit)
    .map(({ id, crateMates }) => ({ matchKey: keyFromNumber(id), crateMates }));
}

/**
 * Whether a candidate can still make the top `limit` of `top` (ranked). w(i) ≤ 1, so a
 * candidate's crateMateScore is the most it can score.
 */
export function couldRank(
  top: readonly ForYouScored[],
  limit: number,
  crateMateScore: number,
): boolean {
  const last = top[limit - 1];
  return top.length < limit || last === undefined || crateMateScore >= last.score;
}

/**
 * The rank of the first crate mate, in `ranked` order (best first), whose sorted match list holds `id`.
 * Crate mates without a list (never scanned) keep their place, so ranks match the leaderboard.
 */
export function bestCrateMateRank(
  id: number,
  ranked: readonly (Float64Array | undefined)[],
): number | null {
  for (let i = 0; i < ranked.length; i++) {
    const list = ranked[i];
    if (list && holds(list, id)) return i + 1;
  }
  return null;
}

function holds(sorted: Float64Array, id: number): boolean {
  let lo = 0;
  let hi = sorted.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    const value = sorted[mid] as number;
    if (value === id) return true;
    if (value < id) lo = mid + 1;
    else hi = mid - 1;
  }
  return false;
}
