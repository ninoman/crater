import { describe, expect, it } from 'vitest';
import { keyFromNumber, keyToNumber, type ItemKey } from '../bandcamp';
import { freshOwnership, type LatelyTwinMatches } from './fresh';
import { MONTH_MS } from './lately';

const DAY = 86_400_000;
const NOW = 2000 * DAY;
const HALF_LIFE = 6 * MONTH_MS;

/** A lately twin's list: each release with how many days ago they bought it, null if undated. */
function twin(score: number, buys: [ItemKey, number | null][]): LatelyTwinMatches {
  return {
    score,
    matches: Float64Array.from(buys.map(([key]) => keyToNumber(key))),
    times: Float64Array.from(buys.map(([, days]) => (days === null ? 0 : NOW - days * DAY))),
  };
}

const ids = (owned: ReturnType<typeof freshOwnership>) => owned.map((c) => keyFromNumber(c.id));

describe('freshOwnership', () => {
  it('ranks recent buys by lately twins above old ones', () => {
    const owned = freshOwnership(
      [
        twin(1, [
          ['a1', 7],
          ['a2', 330],
        ]),
        twin(1, [
          ['a2', 300],
          ['a3', 30],
        ]),
      ],
      new Set(),
      NOW,
      HALF_LIFE,
    );

    // a2 has two twins, but both bought it most of a year ago.
    expect(ids(owned)).toEqual(['a1', 'a3', 'a2']);
    expect(owned[0]?.twinScore).toBeCloseTo(2 ** (-7 / (6 * 30.4375)), 6);
  });

  it('weighs each purchase by the twin’s lately score', () => {
    const owned = freshOwnership(
      [twin(3, [['a1', 60]]), twin(1, [['a2', 0]])],
      new Set(),
      NOW,
      HALF_LIFE,
    );

    // 3 × fade(2 months) ≈ 2.4 beats 1 × fade(today) = 1.
    expect(ids(owned)).toEqual(['a1', 'a2']);
    expect(owned[1]?.twinScore).toBe(1);
  });

  it('leaves out excluded, undated and over-a-year-old buys', () => {
    const owned = freshOwnership(
      [
        twin(1, [
          ['a1', 10],
          ['a2', null],
          ['a3', 366],
          ['a4', 364],
        ]),
      ],
      new Set([keyToNumber('a1')]),
      NOW,
      HALF_LIFE,
    );

    expect(ids(owned)).toEqual(['a4']);
  });

  it('counts the twins and keeps the newest purchase', () => {
    const [only] = freshOwnership(
      [twin(1, [['a1', 40]]), twin(1, [['a1', 4]])],
      new Set(),
      NOW,
      HALF_LIFE,
    );

    expect(only).toMatchObject({ twins: 2, lastBoughtAt: NOW - 4 * DAY });
  });
});
