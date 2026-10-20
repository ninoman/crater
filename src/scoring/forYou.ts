// "For you": what your top taste twins own, weighted by how alike each twin is and by rarity.
// score(i) = Σ over top-K twins F owning i of score(F) × w(i). Pure: src/db gathers the data
// and src/background runs the steps.

import { keyFromNumber, type ItemKey } from '../bandcamp';
import { weight } from './weights';

export const FOR_YOU_LIMIT = 30;
/** Diversity rule: at most this many releases per artist in the first DIVERSE_ROWS rows. */
export const MAX_PER_ARTIST = 2;
export const DIVERSE_ROWS = 20;

export interface Twin {
  fanId: number;
  score: number;
}

/** A top twin with their distinct collection match ids (a `fanMatches` list). */
export interface TwinMatches {
  score: number;
  matches: Float64Array;
}

/** The K most alike twins. Ties break on fanId, so the same data always picks the same twins. */
export function topTwins<T extends Twin>(twins: readonly T[], k: number): T[] {
  return [...twins].sort((a, b) => b.score - a.score || a.fanId - b.fanId).slice(0, k);
}

export interface TwinOwned {
  /** The release, as keyToNumber(matchKey). */
  id: number;
  /** Σ score(F) over the twins owning it. w(i) ≤ 1, so this is also the score's ceiling. */
  twinScore: number;
  /** How many of the twins own it, for "owned by N of your top twins". */
  twins: number;
}

/**
 * Sums twin scores per match id across the twins' lists (each holds distinct ids, so tracks of
 * an album already count once per twin) and drops excluded ids. Highest twinScore first.
 */
export function twinOwnership(
  twins: readonly TwinMatches[],
  excluded: ReadonlySet<number>,
): TwinOwned[] {
  const byId = new Map<number, TwinOwned>();
  for (const twin of twins) {
    for (const id of twin.matches) {
      if (excluded.has(id)) continue;
      const entry = byId.get(id);
      if (entry) {
        entry.twinScore += twin.score;
        entry.twins++;
      } else byId.set(id, { id, twinScore: twin.score, twins: 1 });
    }
  }
  return [...byId.values()].sort(
    (a, b) => b.twinScore - a.twinScore || b.twins - a.twins || a.id - b.id,
  );
}

export interface ForYouScored extends TwinOwned {
  supporters: number;
  score: number;
}

/**
 * score = twinScore × w(supporters). A release has at least as many supporters as twins owning
 * it; the clamp guards a stale Bandcamp count.
 */
export function scoreForYou(candidate: TwinOwned, supporterCount: number): ForYouScored {
  const count = Math.max(supporterCount, candidate.twins);
  return { ...candidate, supporters: count, score: candidate.twinScore * weight(count) };
}

/** Best first. Ties break on twins, then id. */
export function rankForYou(scored: readonly ForYouScored[], limit: number): ForYouScored[] {
  return [...scored]
    .sort((a, b) => b.score - a.score || b.twins - a.twins || a.id - b.id)
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
  /** Twins owning it, for the reason line. */
  twins: number;
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
    .map(({ id, twins }) => ({ matchKey: keyFromNumber(id), twins }));
}
