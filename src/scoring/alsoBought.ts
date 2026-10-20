// "Fans of this also bought": co-ownership among a release's supporters, sharpened by lift.
// Pure: src/db gathers the data and src/background runs the steps (decisions §6).

import { keyFromNumber, keyToNumber, type ItemKey } from '../bandcamp';

/** Fewer co-owners than this is likely chance. */
export const MIN_CO_OWNERS = 2;
/** Past this, a higher lift is mostly a tiny base rate, not a stronger link. */
export const LIFT_CAP = 10;
/** Releases your taste twins own score up to this much more: ×(1 + TWIN_BOOST_MAX) at most. */
export const TWIN_BOOST_MAX = 0.5;
/** Releases with fewer known owners than this get same-artist and same-label picks blended in. */
export const SMALL_RELEASE_OWNERS = 8;
export const ALSO_BOUGHT_LIMIT = 30;

export interface CoOwned {
  /** The release, as keyToNumber(matchKey). */
  id: number;
  /** How many of the release's supporters own it. */
  co: number;
}

/**
 * Counts co-owners per match id across the supporters' lists (each holds distinct ids), drops
 * excluded ids and co < MIN_CO_OWNERS, and sorts by co, highest first, then by id. One native
 * sort over all ids, then counting runs, allocates far less than a Map over ~300k ids.
 */
export function coOwnership(
  ownerLists: readonly Float64Array[],
  excluded: ReadonlySet<number>,
): CoOwned[] {
  let total = 0;
  for (const list of ownerLists) total += list.length;
  const all = new Float64Array(total);
  let offset = 0;
  for (const list of ownerLists) {
    all.set(list, offset);
    offset += list.length;
  }
  all.sort();

  const result: CoOwned[] = [];
  for (let start = 0; start < all.length; ) {
    const id = all[start] as number;
    let end = start + 1;
    while (end < all.length && all[end] === id) end++;
    const co = end - start;
    if (co >= MIN_CO_OWNERS && !excluded.has(id)) result.push({ id, co });
    start = end;
  }
  return result.sort((a, b) => b.co - a.co || a.id - b.id);
}

export interface Basis {
  /** N: the release's supporters whose collection we've read. */
  supporters: number;
  /** Fans with a known collection: the base rate's denominator. */
  population: number;
}

/**
 * lift = P(owns i | owns the release) / P(owns i) = (co / N) / (owners / population), capped.
 * `owners` can't be below `co`, nor `population` below N; clamping guards a stale count.
 */
export function lift(co: number, owners: number, basis: Basis): number {
  const n = Math.max(basis.supporters, co);
  const population = Math.max(basis.population, n);
  const base = Math.max(owners, co) / population;
  return Math.min(LIFT_CAP, co / n / base);
}

/** One of the release's scanned supporters who is also one of your taste twins. */
export interface TwinSupporter {
  /** Their twin score (scoring/twins.ts). */
  score: number;
  /** Their distinct collection match ids. */
  matchIds: Float64Array;
}

export interface TwinBoost {
  /** min(1, Σ score(F) / your best twin's score) over the twin supporters owning it. */
  share: number;
  /** How many of them own it, for the reason line. */
  twins: number;
}

const NO_TWINS: TwinBoost = { share: 0, twins: 0 };

/**
 * Per match id, how strongly your twins among the release's supporters own it. Scores are
 * scaled by your best twin's, so your closest twin alone, or two half as close, gives the full
 * boost. Only supporters count: they're the fans whose collections the co-counts come from.
 */
export function twinBoosts(
  twins: readonly TwinSupporter[],
  bestTwinScore: number,
): Map<number, TwinBoost> {
  const boosts = new Map<number, TwinBoost>();
  if (bestTwinScore <= 0) return boosts;
  for (const twin of twins) {
    const part = twin.score / bestTwinScore;
    for (const id of twin.matchIds) {
      const boost = boosts.get(id);
      if (boost) {
        boost.share = Math.min(1, boost.share + part);
        boost.twins++;
      } else boosts.set(id, { share: Math.min(1, part), twins: 1 });
    }
  }
  return boosts;
}

/** The highest share any release reaches, which bounds what the rest can score. */
export function maxTwinShare(boosts: ReadonlyMap<number, TwinBoost>): number {
  let max = 0;
  for (const { share } of boosts.values()) if (share > max) max = share;
  return max;
}

export interface Scored extends CoOwned {
  owners: number;
  lift: number;
  /** Twin supporters owning it, for the reason line. */
  twins: number;
  score: number;
}

/** score = co × ln(1 + lift) × (1 + TWIN_BOOST_MAX × twin share), decisions §6. */
export function scoreCoOwned(
  candidate: CoOwned,
  owners: number,
  basis: Basis,
  twin: TwinBoost = NO_TWINS,
): Scored {
  const value = lift(candidate.co, owners, basis);
  return {
    ...candidate,
    owners,
    lift: value,
    twins: twin.twins,
    score: candidate.co * Math.log1p(value) * (1 + TWIN_BOOST_MAX * twin.share),
  };
}

/** The best score `co` co-owners can reach, whatever the base rate, at a given twin share. */
export function scoreCeiling(co: number, twinShare: number): number {
  return co * Math.log1p(LIFT_CAP) * (1 + TWIN_BOOST_MAX * twinShare);
}

/** Best first. Ties break on co, then id, so the same data always ranks the same way. */
export function rankScored(scored: readonly Scored[], limit: number): Scored[] {
  return [...scored]
    .sort((a, b) => b.score - a.score || b.co - a.co || a.id - b.id)
    .slice(0, limit);
}

/**
 * Whether a candidate with `co` co-owners and up to `twinShare` could still enter a full `top`
 * list. Candidates come in falling co order, so with the highest share any of them has, the
 * first one that can't means none of the rest can either.
 */
export function couldEnter(
  top: readonly Scored[],
  limit: number,
  co: number,
  twinShare: number,
): boolean {
  const last = top[limit - 1];
  return top.length < limit || last === undefined || scoreCeiling(co, twinShare) >= last.score;
}

export function isSmallRelease(knownOwners: number): boolean {
  return knownOwners < SMALL_RELEASE_OWNERS;
}

export interface Seller {
  artist: string;
  bandId: number;
  labelId: number | null;
}

/** A release from the same account or label, with its supporters(i) for ordering. */
export interface SellerItem extends Seller {
  itemKey: ItemKey;
  albumKey: ItemKey | null;
  supporters: number;
}

export type FallbackKind = 'same-artist' | 'same-label';

export interface FallbackPick {
  matchKey: ItemKey;
  kind: FallbackKind;
}

function sameName(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/**
 * Same-artist and same-label picks for a small release. An item sold from the same account by
 * a different artist means the account is a label's. Same artist first, then most collected.
 */
export function fallbackPicks(
  release: Seller,
  items: readonly SellerItem[],
  excluded: ReadonlySet<number>,
  limit: number,
): FallbackPick[] {
  return items
    .filter((item) => item.albumKey === null && !excluded.has(keyToNumber(item.itemKey)))
    .filter(
      (item) =>
        item.bandId === release.bandId ||
        (release.labelId !== null && item.labelId === release.labelId),
    )
    .map((item) => ({
      item,
      kind: (sameName(item.artist, release.artist) ? 'same-artist' : 'same-label') as FallbackKind,
    }))
    .sort(
      (a, b) =>
        Number(b.kind === 'same-artist') - Number(a.kind === 'same-artist') ||
        b.item.supporters - a.item.supporters ||
        keyToNumber(a.item.itemKey) - keyToNumber(b.item.itemKey),
    )
    .slice(0, limit)
    .map(({ item, kind }) => ({ matchKey: item.itemKey, kind }));
}

export type AlsoBoughtPick =
  | { matchKey: ItemKey; kind: 'co-owned'; co: number; twins: number }
  | FallbackPick;

/** Co-owned picks first, then fallback picks they don't already cover. */
export function blendPicks(
  scored: readonly Scored[],
  fallback: readonly FallbackPick[],
  limit: number,
): AlsoBoughtPick[] {
  const picks: AlsoBoughtPick[] = scored.map(({ id, co, twins }) => ({
    matchKey: keyFromNumber(id),
    kind: 'co-owned',
    co,
    twins,
  }));
  const taken = new Set(picks.map((pick) => pick.matchKey));
  return [...picks, ...fallback.filter((pick) => !taken.has(pick.matchKey))].slice(0, limit);
}
