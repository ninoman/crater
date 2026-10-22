import { describe, expect, it } from 'vitest';
import { feedTwins, latestPurchases, type TwinPurchases } from './twinsLatest';

function twin(fanId: number, bought: [id: number, at: number][]): TwinPurchases {
  const sorted = [...bought].sort((a, b) => a[0] - b[0]);
  return {
    fanId,
    matchIds: Float64Array.from(sorted.map(([id]) => id)),
    matchTimes: Float64Array.from(sorted.map(([, at]) => at)),
  };
}

describe('latestPurchases', () => {
  it('lists releases bought since the cut-off, newest first, with every twin who bought them', () => {
    const picks = latestPurchases(
      [
        twin(10, [
          [1, 500],
          [2, 300],
          [3, 50],
        ]),
        twin(11, [
          [2, 400],
          [4, 300],
        ]),
      ],
      new Set(),
      100,
    );
    expect(picks).toEqual([
      { id: 1, boughtAt: 500, fanIds: [10] },
      { id: 2, boughtAt: 400, fanIds: [10, 11] },
      { id: 4, boughtAt: 300, fanIds: [11] },
    ]);
  });

  it('leaves out what you own or hid, and undated purchases', () => {
    const picks = latestPurchases(
      [
        twin(10, [
          [1, 500],
          [2, 0],
          [3, 400],
        ]),
      ],
      new Set([1]),
      100,
    );
    expect(picks.map((pick) => pick.id)).toEqual([3]);
  });

  it('puts the release more twins bought first on a tie', () => {
    const picks = latestPurchases(
      [
        twin(10, [
          [1, 200],
          [2, 200],
        ]),
        twin(11, [[2, 150]]),
      ],
      new Set(),
      100,
    );
    expect(picks.map((pick) => pick.id)).toEqual([2, 1]);
  });
});

describe('feedTwins', () => {
  it('takes each board’s top k, the first board first, without repeats', () => {
    expect(
      feedTwins(
        [
          [5, 6, 7],
          [6, 8, 9],
        ],
        2,
      ),
    ).toEqual([5, 6, 8]);
  });
});
