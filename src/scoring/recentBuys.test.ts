import { describe, expect, it } from 'vitest';
import { recentBuys } from './recentBuys';

function lists(bought: [id: number, at: number][]) {
  return {
    matchIds: Float64Array.from(bought.map(([id]) => id)),
    matchTimes: Float64Array.from(bought.map(([, at]) => at)),
  };
}

describe('recentBuys', () => {
  it('keeps the newest up to the limit, newest first', () => {
    const buys = recentBuys(
      lists([
        [1, 100],
        [2, 300],
        [3, 200],
        [4, 50],
      ]),
      3,
    );
    expect(buys).toEqual([
      { id: 2, boughtAt: 300 },
      { id: 3, boughtAt: 200 },
      { id: 1, boughtAt: 100 },
    ]);
  });

  it('leaves out purchases with no known time and breaks ties by id', () => {
    const buys = recentBuys(
      lists([
        [7, 100],
        [5, 0],
        [6, 100],
      ]),
      5,
    );
    expect(buys.map((buy) => buy.id)).toEqual([6, 7]);
  });
});
