// Taste twins: fans whose collections overlap most with yours, weighted towards rare releases.
// Pure: lists are sorted match ids (keyToNumber), as stored in `fanMatches` (decisions §6).

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

export interface Candidate {
  fanId: number;
  matchIds: Float64Array;
  /** Purchase time of each of `matchIds`, 0 when unknown. */
  matchTimes: Float64Array;
  /** Their collection size as far as we know it, for the size filter. */
  size: number;
}

export interface TwinInput {
  /** Your collection, sorted. */
  mine: Float64Array;
  /** Purchase time of each of `mine`, 0 when unknown. */
  mineTimes: Float64Array;
  /** w(i) for each of your match ids. Overlap only ever touches yours. */
  weights: ReadonlyMap<number, number>;
  /** Label of a match id: label_id, else the selling account (decisions §3.3). */
  labelOf: ReadonlyMap<number, number>;
  /** Distinct match ids per label in the local DB: the label's catalog for the MVP. */
  catalogSize: ReadonlyMap<number, number>;
  minCollectionSize: number;
  maxCollectionSize: number;
  labelClusterDownweight: boolean;
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

/** Where the ids both sorted lists hold sit in each. Linear merge of two sorted lists. */
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

/** Your match ids that the fan's sorted list also holds. */
export function intersect(mine: Float64Array, theirs: Float64Array): number[] {
  return sharedPositions(mine, theirs).map((at) => mine[at.mine] as number);
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
  const { mine, weights } = input;
  const theirs = candidate.matchIds;
  if (candidate.size < input.minCollectionSize || candidate.size > input.maxCollectionSize) {
    return null;
  }
  if (mine.length === 0 || theirs.length === 0) return null;

  const positions = sharedPositions(mine, theirs);
  if (positions.length === 0) return null;
  const shared = positions.map((at) => mine[at.mine] as number);

  let weighted = 0;
  for (const id of shared) weighted += weights.get(id) ?? 0;
  const labelCluster = isLabelCluster(shared, theirs, input.labelOf, input.catalogSize);
  const factor = labelCluster && input.labelClusterDownweight ? LABEL_CLUSTER_FACTOR : 1;
  const latelyAt = (when: LatelyInput['now']) => {
    const score = latelyScore(positions, input.mineTimes, candidate, weights, when, input.lately);
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
      input.mineTimes,
      candidate.matchTimes,
      input.lately.now.at - TREND_LOOKBACK_MS,
    ),
  };
}

/** Best first: score, then raw overlap, then fanId so ties are stable. */
export function compareTwins(a: Twin, b: Twin): number {
  return b.score - a.score || b.overlap - a.overlap || a.fanId - b.fanId;
}

/** Whether a twin belongs on the lately leaderboard: active lately, with something in common. */
export function isLatelyTwin(twin: Twin): boolean {
  return twin.lately !== null && twin.lately > 0;
}

/** Best first by lately, then the all-time order. Twins without a lately score go last. */
export function compareLately(a: Twin, b: Twin): number {
  return (b.lately ?? -1) - (a.lately ?? -1) || compareTwins(a, b);
}
