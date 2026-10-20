// "Fans of this also bought": co-ownership among a release's supporters, sharpened by lift.
// Pure: src/db gathers the data and src/background runs the steps (decisions §6).

import { keyFromNumber, keyToNumber, type ItemKey } from '../bandcamp';

/** Fewer co-owners than this is likely chance. */
export const MIN_CO_OWNERS = 2;
/** Past this, a higher lift is mostly a tiny base rate, not a stronger link. */
export const LIFT_CAP = 10;
/** Stub until Phase 5, which boosts releases your taste twins own. */
export const TWIN_BOOST = 0;
/** Releases with fewer known owners than this get same-artist and same-label picks blended in. */
export const SMALL_RELEASE_OWNERS = 8;
export const ALSO_BOUGHT_LIMIT = 30;

/** One ownership row of yours, as far as filtering cares. */
export interface MyRow {
  itemKey: ItemKey;
  matchKey: ItemKey;
  source: 'collection' | 'wishlist';
}

/** Keyed by match id (keyToNumber), like the lists they filter. */
export interface Exclusions {
  excluded: Set<number>;
  /** Albums you own some tracks of. They stay in, tagged with the count (decisions §3.8). */
  ownedTracks: Map<number, number>;
}

/**
 * What never gets recommended: the release itself, hidden releases, and releases you own or
 * wishlisted as a whole. Owning or wishlisting a track of an album keeps the album in.
 */
export function exclusions(
  mine: readonly MyRow[],
  hidden: ReadonlySet<ItemKey>,
  release: ItemKey,
): Exclusions {
  const excluded = new Set([release, ...hidden].map(keyToNumber));
  const ownedTracks = new Map<number, number>();
  for (const row of mine) {
    const id = keyToNumber(row.matchKey);
    if (row.itemKey === row.matchKey) excluded.add(id);
    else if (row.source === 'collection') ownedTracks.set(id, (ownedTracks.get(id) ?? 0) + 1);
  }
  for (const key of excluded) ownedTracks.delete(key);
  return { excluded, ownedTracks };
}

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
  for (let start = 0; start < all.length;) {
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

export interface Scored extends CoOwned {
  owners: number;
  lift: number;
  score: number;
}

/** score = co × ln(1 + lift), plus the twin boost (0 until Phase 5). */
export function scoreCoOwned(candidate: CoOwned, owners: number, basis: Basis): Scored {
  const value = lift(candidate.co, owners, basis);
  return {
    ...candidate,
    owners,
    lift: value,
    score: candidate.co * Math.log1p(value) + TWIN_BOOST,
  };
}

/** The best score `co` co-owners can reach, whatever the base rate. */
export function scoreCeiling(co: number): number {
  return co * Math.log1p(LIFT_CAP) + TWIN_BOOST;
}

/** Best first. Ties break on co, then id, so the same data always ranks the same way. */
export function rankScored(scored: readonly Scored[], limit: number): Scored[] {
  return [...scored]
    .sort((a, b) => b.score - a.score || b.co - a.co || a.id - b.id)
    .slice(0, limit);
}

/**
 * Whether a candidate with `co` co-owners could still enter a full `top` list. Candidates come
 * in falling co order, so the first one that can't means none of the rest can either.
 */
export function couldEnter(top: readonly Scored[], limit: number, co: number): boolean {
  const last = top[limit - 1];
  return top.length < limit || last === undefined || scoreCeiling(co) >= last.score;
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

export type AlsoBoughtPick = { matchKey: ItemKey; kind: 'co-owned'; co: number } | FallbackPick;

/** Co-owned picks first, then fallback picks they don't already cover. */
export function blendPicks(
  scored: readonly Scored[],
  fallback: readonly FallbackPick[],
  limit: number,
): AlsoBoughtPick[] {
  const picks: AlsoBoughtPick[] = scored.map(({ id, co }) => ({
    matchKey: keyFromNumber(id),
    kind: 'co-owned',
    co,
  }));
  const taken = new Set(picks.map((pick) => pick.matchKey));
  return [...picks, ...fallback.filter((pick) => !taken.has(pick.matchKey))].slice(0, limit);
}
