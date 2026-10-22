// Taste twins: fans whose collections overlap most with yours, weighted towards rare releases.
// Pure: lists are sorted ids (keyToNumber), as stored in `fanMatches` (decisions §6).

import { withoutCompilations } from './compilations';
import {
  boughtSince,
  latelyScore,
  TREND_LOOKBACK_MS,
  type LatelyInput,
  type SharedPosition,
} from './lately';

/** A twin whose overlap is mostly one label's catalog is down-weighted by this. */
export const LABEL_CLUSTER_FACTOR = 0.3;
/** More than this share of the overlap from one label... */
export const LABEL_CLUSTER_OVERLAP_SHARE = 0.5;
/** ...and the fan owns more than this share of that label's local catalog. */
export const LABEL_CLUSTER_CATALOG_SHARE = 0.6;
/**
 * ...and at least this many shared releases come from it. Local catalogs start tiny, so one
 * shared release would otherwise make anyone owning it "most of the label".
 */
export const LABEL_CLUSTER_MIN_SHARED = 3;

/** One collection's lists, as a `fanMatches` record holds them. */
export interface CollectionLists {
  matchIds: Float64Array;
  /** Tracks owned that belong to an album. */
  trackIds: Float64Array;
  /** matchIds held only through tracks, not the album itself. */
  partialIds: Float64Array;
  /** Newest purchase time under each of `matchIds`, 0 when unknown. */
  matchTimes: Float64Array;
}

export interface Candidate extends CollectionLists {
  fanId: number;
  /** Their collection size as far as we know it, for the size filter. */
  size: number;
}

export interface MyCollection extends CollectionLists {
  /** The album match id of each of your trackIds. */
  albumOfTrack: ReadonlyMap<number, number>;
}

export interface TwinInput {
  mine: MyCollection;
  /** w(i) for each of your match ids. Overlap only ever touches yours. */
  weights: ReadonlyMap<number, number>;
  /** Label of a match id: label_id, else the selling account (decisions §3.3). */
  labelOf: ReadonlyMap<number, number>;
  /** Distinct match ids per label in the local DB: the label's catalog for the MVP. */
  catalogSize: ReadonlyMap<number, number>;
  minCollectionSize: number;
  maxCollectionSize: number;
  labelClusterDownweight: boolean;
  /** Your match ids that are compilations, left out of overlap (decisions §17). Empty when off. */
  compilations: ReadonlySet<number>;
  lately: LatelyInput;
}

export interface Twin {
  fanId: number;
  overlap: number;
  jaccard: number;
  /** Σ w(i) over the overlap / √(|M|·|F|), × LABEL_CLUSTER_FACTOR when flagged and enabled. */
  score: number;
  labelCluster: boolean;
  /** In step with your recent buying (scoring/lately.ts), × the same label factor as `score`. */
  lately: number | null;
  yearAgo: number | null;
  /** Shared releases you both bought within the last year. */
  latelyOverlap: number;
}

/** Where the ids both sorted lists hold sit in each. Same merge as `intersect`. */
export function sharedPositions(mine: Float64Array, theirs: Float64Array): SharedPosition[] {
  const shared: SharedPosition[] = [];
  let i = 0;
  let j = 0;
  while (i < mine.length && j < theirs.length) {
    const a = mine[i] as number;
    const b = theirs[j] as number;
    if (a === b) {
      shared.push({ mine: i, theirs: j });
      i++;
      j++;
    } else if (a < b) i++;
    else j++;
  }
  return shared;
}

/** Your match ids that the fan's sorted list also holds. Linear merge of two sorted lists. */
export function intersect(mine: Float64Array, theirs: Float64Array): number[] {
  const shared: number[] = [];
  let i = 0;
  let j = 0;
  while (i < mine.length && j < theirs.length) {
    const a = mine[i] as number;
    const b = theirs[j] as number;
    if (a === b) {
      shared.push(a);
      i++;
      j++;
    } else if (a < b) i++;
    else j++;
  }
  return shared;
}

/**
 * Where each release you and a fan share sits in your and their `matchIds`. An exact item
 * matches, and so does an album against one of its tracks, but two different tracks of one album
 * don't (decisions §7).
 */
export function sharedReleasePositions(
  mine: MyCollection,
  theirs: CollectionLists,
): SharedPosition[] {
  const tracksOnly = new Set(intersect(mine.partialIds, theirs.partialIds));
  for (const track of intersect(mine.trackIds, theirs.trackIds)) {
    const album = mine.albumOfTrack.get(track);
    if (album !== undefined) tracksOnly.delete(album);
  }
  const shared = sharedPositions(mine.matchIds, theirs.matchIds);
  if (tracksOnly.size === 0) return shared;
  return shared.filter((at) => !tracksOnly.has(mine.matchIds[at.mine] as number));
}

/** The match ids of the releases you and a fan share (`sharedReleasePositions`). */
export function sharedReleases(mine: MyCollection, theirs: CollectionLists): number[] {
  return sharedReleasePositions(mine, theirs).map((at) => mine.matchIds[at.mine] as number);
}

/**
 * Flags a fan whose overlap with you is mostly one label they collect wholesale: a label
 * subscriber, not a taste match. Only the dominant label can pass the overlap share test.
 */
export function isLabelCluster(
  shared: readonly number[],
  theirs: Float64Array,
  labelOf: ReadonlyMap<number, number>,
  catalogSize: ReadonlyMap<number, number>,
): boolean {
  const perLabel = new Map<number, number>();
  for (const id of shared) {
    const label = labelOf.get(id);
    if (label !== undefined) perLabel.set(label, (perLabel.get(label) ?? 0) + 1);
  }
  let top: number | undefined;
  let topCount = 0;
  for (const [label, count] of perLabel) {
    if (count > topCount) [top, topCount] = [label, count];
  }
  if (top === undefined || topCount < LABEL_CLUSTER_MIN_SHARED) return false;
  if (topCount <= shared.length * LABEL_CLUSTER_OVERLAP_SHARE) return false;

  const catalog = catalogSize.get(top) ?? 0;
  if (catalog === 0) return false;
  let owned = 0;
  for (const id of theirs) if (labelOf.get(id) === top) owned++;
  return owned > catalog * LABEL_CLUSTER_CATALOG_SHARE;
}

/** Scores one fan against you, or null if they're filtered out or share nothing. */
export function scoreTwin(candidate: Candidate, input: TwinInput): Twin | null {
  const { weights } = input;
  const mine = input.mine.matchIds;
  const theirs = candidate.matchIds;
  if (candidate.size < input.minCollectionSize || candidate.size > input.maxCollectionSize) {
    return null;
  }
  if (mine.length === 0 || theirs.length === 0) return null;

  const positions = withoutCompilations(
    sharedReleasePositions(input.mine, candidate),
    mine,
    input.compilations,
  );
  if (positions.length === 0) return null;
  const shared = positions.map((at) => mine[at.mine] as number);

  let weighted = 0;
  for (const id of shared) weighted += weights.get(id) ?? 0;
  const labelCluster = isLabelCluster(shared, theirs, input.labelOf, input.catalogSize);
  const factor = labelCluster && input.labelClusterDownweight ? LABEL_CLUSTER_FACTOR : 1;
  const latelyAt = (when: LatelyInput['now']) => {
    const score = latelyScore(
      positions,
      input.mine.matchTimes,
      candidate,
      weights,
      when,
      input.lately,
    );
    return score === null ? null : score * factor;
  };

  return {
    fanId: candidate.fanId,
    overlap: shared.length,
    jaccard: shared.length / (mine.length + theirs.length - shared.length),
    score: (weighted / Math.sqrt(mine.length * theirs.length)) * factor,
    labelCluster,
    lately: latelyAt(input.lately.now),
    yearAgo: latelyAt(input.lately.yearAgo),
    latelyOverlap: boughtSince(
      positions,
      input.mine.matchTimes,
      candidate.matchTimes,
      input.lately.now.at - TREND_LOOKBACK_MS,
    ),
  };
}

/** Best first: score, then raw overlap, then fanId so ties are stable. */
export function compareTwins(a: Twin, b: Twin): number {
  return b.score - a.score || b.overlap - a.overlap || a.fanId - b.fanId;
}

/**
 * Whether a twin belongs on the lately leaderboard: active lately, and sharing a release you
 * both bought this past year. Old overlap alone still scores a sliver above 0.
 */
export function isLatelyTwin(twin: Twin): boolean {
  return twin.lately !== null && twin.latelyOverlap > 0;
}

/** Best first by lately, then the all-time order. Twins without a lately score go last. */
export function compareLately(a: Twin, b: Twin): number {
  return (b.lately ?? -1) - (a.lately ?? -1) || compareTwins(a, b);
}
