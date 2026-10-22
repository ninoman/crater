// "Fans of this also bought": co-ownership among a release's supporters, sharpened by lift.
// Pure: src/db gathers the data and src/background runs the steps (decisions §6).

import { keyFromNumber, keyToNumber, type ItemKey } from '../bandcamp';
import type { AlsoBoughtWarmup } from '../shared/alsoBought';

/** Fewer co-owners than this is likely chance. */
export const MIN_CO_OWNERS = 2;
/** Past this, a higher lift is mostly a tiny base rate, not a stronger link. */
export const LIFT_CAP = 10;
/** Releases your crate mates own score up to this much more: ×(1 + CRATE_MATE_BOOST_MAX) at most. */
export const CRATE_MATE_BOOST_MAX = 0.5;
/** Releases with fewer known owners than this get same-artist and same-label picks blended in. */
export const SMALL_RELEASE_OWNERS = 8;
export const ALSO_BOUGHT_LIMIT = 30;
/** z for the one-sided 95% lower bound on the share of supporters owning a release. */
export const CONFIDENCE_Z = 1.645;
/** Collections up to this size cast a full vote; bigger ones count for less. */
export const FULL_VOTE_ITEMS = 250;
/** A row passes the confidence bar when even its cautious lift is at least this. */
export const CONFIDENT_LIFT = 2;
/** Co-owned rows wait until this many supporters are read (or all of them, if fewer)… */
export const WARMUP_SUPPORTERS = 20;
/** …and this many rows pass the confidence bar. */
export const WARMUP_ROWS = 5;

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

/** One of the release's supporters whose collection we've read. */
export interface SupporterList {
  /** Their distinct collection match ids, sorted. */
  matchIds: Float64Array;
  /** Their collection size, as far as we know it. */
  size: number;
}

/**
 * How much one co-owner's vote counts. The chance of owning any given release by accident grows
 * with collection size, so a 2,000-item omnivore's purchases say less about this release's
 * buyers than a 100-item collector's. √ rather than 1/size: it's the damping the crate mate score and
 * the planned fan-page ranking use (√ of both sizes), and 1/size would throw away most of what
 * big collectors tell us. Flat at 1 up to FULL_VOTE_ITEMS so no vote exceeds 1, which keeps
 * `co` an upper bound for the pruning.
 */
export function voteWeight(size: number): number {
  return size <= FULL_VOTE_ITEMS ? 1 : Math.sqrt(FULL_VOTE_ITEMS / size);
}

function includes(sorted: Float64Array, id: number): boolean {
  let lo = 0;
  let hi = sorted.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const value = sorted[mid] as number;
    if (value === id) return true;
    if (value < id) lo = mid + 1;
    else hi = mid - 1;
  }
  return false;
}

/**
 * Σ voteWeight over the supporters owning each id. Asked only for the candidates about to be
 * scored, so a binary search per list beats tagging every id in coOwnership with its owner.
 */
export function coOwnerVotes(
  ids: readonly number[],
  supporters: readonly SupporterList[],
): Map<number, number> {
  const votes = new Map<number, number>(ids.map((id) => [id, 0]));
  for (const { matchIds, size } of supporters) {
    const weight = voteWeight(size);
    for (const id of ids) {
      if (includes(matchIds, id)) votes.set(id, (votes.get(id) ?? 0) + weight);
    }
  }
  return votes;
}

/**
 * Wilson score interval's lower bound on a share seen as `hits` of `trials`. It shrinks a share
 * by how little has been seen: 3 of 8 (0.375) comes out at about 0.16, 30 of 80 at about 0.29.
 * `hits` may be fractional (weighted votes).
 */
export function wilsonLower(hits: number, trials: number, z: number = CONFIDENCE_Z): number {
  if (trials <= 0) return 0;
  const p = Math.min(1, hits / trials);
  const z2 = z * z;
  const centre = p + z2 / (2 * trials);
  const margin = z * Math.sqrt((p * (1 - p)) / trials + z2 / (4 * trials * trials));
  return Math.max(0, (centre - margin) / (1 + z2 / trials));
}

export interface Basis {
  /** N: the release's supporters whose collection we've read. */
  supporters: number;
  /** Fans with a known collection: the base rate's denominator. */
  population: number;
}

/**
 * lift = P(owns i | owns the release) / P(owns i), capped. P(owns i | owns the release) is the
 * Wilson lower bound on votes / N, so a share seen among few supporters counts for less.
 * `owners` can't be below `votes`, nor `population` below N; clamping guards a stale count.
 */
export function lift(votes: number, owners: number, basis: Basis): number {
  const n = Math.max(basis.supporters, votes);
  const population = Math.max(basis.population, n);
  const base = Math.max(owners, votes) / population;
  return Math.min(LIFT_CAP, wilsonLower(votes, n) / base);
}

/** One of the release's scanned supporters who is also one of your crate mates. */
export interface CrateMateSupporter {
  /** Their crate mate score (scoring/crate mates.ts). */
  score: number;
  /** Their distinct collection match ids. */
  matchIds: Float64Array;
}

export interface CrateMateBoost {
  /** min(1, Σ score(F) / your best crate mate's score) over the crate mate supporters owning it. */
  share: number;
  /** How many of them own it, for the reason line. */
  crateMates: number;
}

const NO_CRATE_MATES: CrateMateBoost = { share: 0, crateMates: 0 };

/**
 * Per match id, how strongly your crate mates among the release's supporters own it. Scores are
 * scaled by your best crate mate's, so your closest crate mate alone, or two half as close, gives the full
 * boost. Only supporters count: they're the fans whose collections the co-counts come from.
 */
export function crateMateBoosts(
  crateMates: readonly CrateMateSupporter[],
  bestCrateMateScore: number,
): Map<number, CrateMateBoost> {
  const boosts = new Map<number, CrateMateBoost>();
  if (bestCrateMateScore <= 0) return boosts;
  for (const crateMate of crateMates) {
    const part = crateMate.score / bestCrateMateScore;
    for (const id of crateMate.matchIds) {
      const boost = boosts.get(id);
      if (boost) {
        boost.share = Math.min(1, boost.share + part);
        boost.crateMates++;
      } else boosts.set(id, { share: Math.min(1, part), crateMates: 1 });
    }
  }
  return boosts;
}

/** The highest share any release reaches, which bounds what the rest can score. */
export function maxCrateMateShare(boosts: ReadonlyMap<number, CrateMateBoost>): number {
  let max = 0;
  for (const { share } of boosts.values()) if (share > max) max = share;
  return max;
}

export interface Voted extends CoOwned {
  /** Σ voteWeight over its co-owners: at most co. */
  votes: number;
}

export interface Scored extends Voted {
  owners: number;
  lift: number;
  /** Crate mate supporters owning it, for the reason line. */
  crateMates: number;
  score: number;
}

/** score = votes × ln(1 + lift) × (1 + CRATE_MATE_BOOST_MAX × crate mate share), decisions §6 and §12. */
export function scoreCoOwned(
  candidate: Voted,
  owners: number,
  basis: Basis,
  crateMate: CrateMateBoost = NO_CRATE_MATES,
): Scored {
  const value = lift(candidate.votes, owners, basis);
  return {
    ...candidate,
    owners,
    lift: value,
    crateMates: crateMate.crateMates,
    score: candidate.votes * Math.log1p(value) * (1 + CRATE_MATE_BOOST_MAX * crateMate.share),
  };
}

/**
 * The best score `co` co-owners can reach, whatever the base rate and their collection sizes,
 * at a given crate mate share. Votes never exceed co.
 */
export function scoreCeiling(co: number, crateMateShare: number): number {
  return co * Math.log1p(LIFT_CAP) * (1 + CRATE_MATE_BOOST_MAX * crateMateShare);
}

/** Best first. Ties break on co, then id, so the same data always ranks the same way. */
export function rankScored(scored: readonly Scored[], limit: number): Scored[] {
  return [...scored]
    .sort((a, b) => b.score - a.score || b.co - a.co || a.id - b.id)
    .slice(0, limit);
}

/**
 * Whether a candidate with `co` co-owners and up to `crateMateShare` could still enter a full `top`
 * list. Candidates come in falling co order, so with the highest share any of them has, the
 * first one that can't means none of the rest can either.
 */
export function couldEnter(
  top: readonly Scored[],
  limit: number,
  co: number,
  crateMateShare: number,
): boolean {
  const last = top[limit - 1];
  return top.length < limit || last === undefined || scoreCeiling(co, crateMateShare) >= last.score;
}

/** Even at the cautious end of its share, clearly more common among buyers than everyone. */
export function isConfident(scored: Scored): boolean {
  return scored.lift >= CONFIDENT_LIFT;
}

/** Where the supporter scan stands, as the warm-up needs it. */
export interface ScanStanding {
  /** N: supporters whose collection has been read. */
  read: number;
  /** Whether every listed supporter's scan has ended (read, private or failed). */
  allScanned: boolean;
  /** Supporters listed, or null before the list is in. */
  listed: number | null;
}

/**
 * Null once co-owned rows can show: every supporter has been scanned, or WARMUP_SUPPORTERS are
 * read and WARMUP_ROWS rows pass the confidence bar. Otherwise how far along the wait is.
 */
export function warmup(standing: ScanStanding, confident: number): AlsoBoughtWarmup | null {
  const readTarget = Math.min(WARMUP_SUPPORTERS, standing.listed ?? WARMUP_SUPPORTERS);
  if (standing.allScanned) return null;
  if (standing.read >= readTarget && confident >= WARMUP_ROWS) return null;
  return {
    read: Math.min(standing.read, readTarget),
    readTarget,
    confident: Math.min(confident, WARMUP_ROWS),
    confidentTarget: WARMUP_ROWS,
  };
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
  | { matchKey: ItemKey; kind: 'co-owned'; co: number; crateMates: number }
  | FallbackPick;

/** Co-owned picks first, then fallback picks they don't already cover. */
export function blendPicks(
  scored: readonly Scored[],
  fallback: readonly FallbackPick[],
  limit: number,
): AlsoBoughtPick[] {
  const picks: AlsoBoughtPick[] = scored.map(({ id, co, crateMates }) => ({
    matchKey: keyFromNumber(id),
    kind: 'co-owned',
    co,
    crateMates,
  }));
  const taken = new Set(picks.map((pick) => pick.matchKey));
  return [...picks, ...fallback.filter((pick) => !taken.has(pick.matchKey))].slice(0, limit);
}
