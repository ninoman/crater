// Lately: how in step a fan's recent buying is with yours (decisions §11). Twins' weighted overlap,
// except every purchase fades with age, a release you both bought around the same time counts
// extra, and the same score taken a year ago gives the trend. Pure: times are ms since epoch,
// 0 when unknown.

import type { Trend } from '../shared/twins';

const DAY_MS = 86_400_000;
export const MONTH_MS = (365.25 / 12) * DAY_MS;
/** Two purchases of a release this close together count as finding it at the same time... */
export const CO_TIMING_WINDOW_MS = 60 * DAY_MS;
/** ...worth up to this much extra, falling to nothing at the window's edge. */
export const CO_TIMING_BONUS = 0.5;
/** The trend compares now with this long ago, and "bought lately" means within it. */
export const TREND_LOOKBACK_MS = 365 * DAY_MS;
/** A score this many times its year-ago value (or less than its inverse) is a trend. */
export const TREND_RATIO = 1.25;

/** When to take the score, with your side's faded collection size worked out once per run. */
export interface Moment {
  at: number;
  /** Σ fade over your purchases. */
  mineSize: number;
}

export interface LatelyInput {
  halfLifeMs: number;
  /** Fans whose faded collection size is below this have no score: too little to go on. */
  minPurchases: number;
  now: Moment;
  yearAgo: Moment;
}

/** One release you both own: where it sits in each list. */
export interface SharedPosition {
  mine: number;
  theirs: number;
}

/** How much a purchase at `time` still counts at `at`: 1 when new, half after each half-life. */
export function fade(time: number, at: number, halfLifeMs: number): number {
  if (time <= 0 || time > at) return 0;
  return 2 ** (-(at - time) / halfLifeMs);
}

/** A collection's size as of `at`, each purchase counted by how much it has faded. */
export function fadedSize(times: Float64Array, at: number, halfLifeMs: number): number {
  let size = 0;
  for (const time of times) size += fade(time, at, halfLifeMs);
  return size;
}

export function moment(at: number, mineTimes: Float64Array, halfLifeMs: number): Moment {
  return { at, mineSize: fadedSize(mineTimes, at, halfLifeMs) };
}

/** ×(1 + CO_TIMING_BONUS) for the same day, falling linearly to ×1 at CO_TIMING_WINDOW_MS. */
export function coTiming(a: number, b: number): number {
  return 1 + CO_TIMING_BONUS * Math.max(0, 1 - Math.abs(a - b) / CO_TIMING_WINDOW_MS);
}

/**
 * Σ w(i) × fade(yours) × fade(theirs) × coTiming over shared releases, divided by
 * √(your faded size × theirs). Twins' score with every purchase weighed by age, so old overlap
 * and old bulk both fade out. Null when either side bought too little by `when`.
 */
export function latelyScore(
  shared: readonly SharedPosition[],
  mineTimes: Float64Array,
  theirs: { matchIds: Float64Array; matchTimes: Float64Array },
  weights: ReadonlyMap<number, number>,
  when: Moment,
  input: Pick<LatelyInput, 'halfLifeMs' | 'minPurchases'>,
): number | null {
  const { at } = when;
  const theirSize = fadedSize(theirs.matchTimes, at, input.halfLifeMs);
  if (when.mineSize === 0 || theirSize < input.minPurchases) return null;

  let sum = 0;
  for (const { mine, theirs: j } of shared) {
    const a = mineTimes[mine] as number;
    const b = theirs.matchTimes[j] as number;
    const faded = fade(a, at, input.halfLifeMs) * fade(b, at, input.halfLifeMs);
    if (faded === 0) continue;
    sum += (weights.get(theirs.matchIds[j] as number) ?? 0) * faded * coTiming(a, b);
  }
  return sum / Math.sqrt(when.mineSize * theirSize);
}

/** Shared releases you both bought since `since`. */
export function boughtSince(
  shared: readonly SharedPosition[],
  mineTimes: Float64Array,
  theirTimes: Float64Array,
  since: number,
): number {
  let count = 0;
  for (const { mine, theirs } of shared) {
    if ((mineTimes[mine] as number) >= since && (theirTimes[theirs] as number) >= since) count++;
  }
  return count;
}

/** Which way a twin is heading, from their lately score now and a year ago. */
export function trendOf(now: number | null, yearAgo: number | null): Trend {
  if (now === null) return 'quiet';
  if (yearAgo === null) return 'new';
  if (now > yearAgo * TREND_RATIO) return 'converging';
  if (now * TREND_RATIO < yearAgo) return 'drifting';
  return 'steady';
}
