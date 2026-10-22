import { describe, expect, it } from 'vitest';
import {
  boughtSince,
  CO_TIMING_BONUS,
  CO_TIMING_WINDOW_MS,
  coTiming,
  fade,
  fadedSize,
  latelyScore,
  moment,
  MONTH_MS,
  trendOf,
  TREND_RATIO,
} from './lately';
import { sharedPositions } from './crateMates';

const HALF_LIFE = 6 * MONTH_MS;
const NOW = 1000 * MONTH_MS;
const ago = (months: number) => NOW - months * MONTH_MS;
const times = (...months: number[]) => Float64Array.from(months.map(ago));
const ids = (...values: number[]) => Float64Array.from(values);
const settings = { halfLifeMs: HALF_LIFE, minPurchases: 0 };

describe('fade', () => {
  it('halves every half-life', () => {
    expect(fade(NOW, NOW, HALF_LIFE)).toBe(1);
    expect(fade(ago(6), NOW, HALF_LIFE)).toBeCloseTo(0.5);
    expect(fade(ago(48), NOW, HALF_LIFE)).toBeCloseTo(1 / 256);
  });

  it('counts nothing undated or bought after the moment', () => {
    expect(fade(0, NOW, HALF_LIFE)).toBe(0);
    expect(fade(NOW + 1, NOW, HALF_LIFE)).toBe(0);
  });

  it('sums a collection by how much each purchase has faded', () => {
    expect(fadedSize(times(0, 6, 12), NOW, HALF_LIFE)).toBeCloseTo(1.75);
  });
});

describe('coTiming', () => {
  it('counts the same day most, falling to nothing at the window edge', () => {
    expect(coTiming(NOW, NOW)).toBe(1 + CO_TIMING_BONUS);
    expect(coTiming(NOW, NOW - CO_TIMING_WINDOW_MS / 2)).toBe(1 + CO_TIMING_BONUS / 2);
    expect(coTiming(NOW - CO_TIMING_WINDOW_MS, NOW)).toBe(1);
    expect(coTiming(0, NOW)).toBe(1);
  });
});

describe('latelyScore', () => {
  const weights = new Map([1, 2, 3, 4, 5, 6].map((id) => [id, 1]));

  /** You own 1–6: the given months ago for each. */
  function score(mineMonths: number[], theirs: [id: number, monthsAgo: number][], min = 0) {
    const mine = ids(1, 2, 3, 4, 5, 6);
    const mineTimes = times(...mineMonths);
    const fan = {
      matchIds: ids(...theirs.map(([id]) => id)),
      matchTimes: times(...theirs.map(([, months]) => months)),
    };
    return latelyScore(
      sharedPositions(mine, fan.matchIds),
      mineTimes,
      fan,
      weights,
      moment(NOW, mineTimes, HALF_LIFE),
      { ...settings, minPurchases: min },
    );
  }

  it('lets overlap from years ago fade next to the same overlap bought lately', () => {
    // The example from decisions §11: lots in common, all bought four years ago.
    const old = score(
      [48, 48, 48, 1, 1, 1],
      [
        [1, 48],
        [2, 48],
        [3, 48],
        [9, 1],
      ],
    );
    const recent = score(
      [48, 48, 48, 1, 1, 1],
      [
        [4, 2],
        [5, 2],
        [6, 2],
        [9, 1],
      ],
    );

    expect(recent ?? 0).toBeGreaterThan(50 * (old ?? 0));
  });

  it('counts buying a release around the same time extra', () => {
    const together = score([1, 1, 1, 1, 1, 1], [[1, 1]]) ?? 0;
    const apart = score([1, 1, 1, 1, 1, 1], [[1, 4]]) ?? 0;

    // Apart, their copy has faded 3 months more (2^(3/6), square-rooted by the normalising
    // on their side) and misses the bonus: 3 months is outside the co-timing window.
    expect(together / apart).toBeCloseTo((1 + CO_TIMING_BONUS) * 2 ** (1 / 4));
  });

  it('is null when the fan bought too little lately, or you bought nothing dated', () => {
    // One purchase 30 months ago is 1/32 of a purchase now.
    expect(score([1, 1, 1, 1, 1, 1], [[1, 30]], 1)).toBeNull();
    expect(score([1, 1, 1, 1, 1, 1], [[1, 0]], 1)).not.toBeNull();

    const undated = new Float64Array(6);
    const fan = { matchIds: ids(1), matchTimes: times(1) };
    const shared = sharedPositions(ids(1, 2, 3, 4, 5, 6), fan.matchIds);
    expect(
      latelyScore(shared, undated, fan, weights, moment(NOW, undated, HALF_LIFE), settings),
    ).toBeNull();
  });
});

describe('boughtSince', () => {
  it('counts shared releases both of you bought since then', () => {
    const shared = sharedPositions(ids(1, 2, 3), ids(1, 2, 3));
    expect(boughtSince(shared, times(1, 1, 20), times(2, 14, 1), ago(12))).toBe(1);
  });
});

describe('trendOf', () => {
  it('compares now with a year ago', () => {
    expect(trendOf(0.5, 0.5 / TREND_RATIO - 0.01)).toBe('converging');
    expect(trendOf(0.5, 0.45)).toBe('steady');
    expect(trendOf(0, 0)).toBe('steady');
    expect(trendOf(0.1, 0.5)).toBe('drifting');
  });

  it('is new without a year-ago score and quiet without one now', () => {
    expect(trendOf(0.2, null)).toBe('new');
    expect(trendOf(null, 0.5)).toBe('quiet');
    expect(trendOf(null, null)).toBe('quiet');
  });
});
