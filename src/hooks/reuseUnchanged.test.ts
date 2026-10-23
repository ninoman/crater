import { describe, expect, it } from 'vitest';
import { reuseUnchanged } from './reuseUnchanged';

interface Row {
  id: string;
  n: number;
}
const key = (row: Row) => row.id;
const same = (a: Row, b: Row) => a.n === b.n;

describe('reuseUnchanged', () => {
  it('keeps the old object for unchanged rows and takes new ones for changed rows', () => {
    const prev = [
      { id: 'a', n: 1 },
      { id: 'b', n: 2 },
    ];
    const next = [
      { id: 'c', n: 3 },
      { id: 'a', n: 1 },
      { id: 'b', n: 5 },
    ];
    const merged = reuseUnchanged(prev, next, key, same);
    expect(merged[1]).toBe(prev[0]);
    expect(merged[0]).toBe(next[0]);
    expect(merged[2]).toBe(next[2]);
  });

  it('returns the previous list when nothing changed', () => {
    const prev = [{ id: 'a', n: 1 }];
    expect(reuseUnchanged(prev, [{ id: 'a', n: 1 }], key, same)).toBe(prev);
  });

  it('notices a removed row', () => {
    const prev = [
      { id: 'a', n: 1 },
      { id: 'b', n: 2 },
    ];
    expect(reuseUnchanged(prev, [{ id: 'a', n: 1 }], key, same)).toEqual([{ id: 'a', n: 1 }]);
  });
});
