import { describe, expect, it } from 'vitest';
import {
  type Box,
  columnCount,
  edgeScroll,
  indexAtPoint,
  keyboardTarget,
  moveId,
  withArrivals,
} from './sortableGrid';

/** A 3-column grid of 100px cells with 20px gaps. */
const grid: Box[] = Array.from({ length: 7 }, (_, i) => {
  const left = (i % 3) * 120;
  const top = Math.floor(i / 3) * 120;
  return { left, top, right: left + 100, bottom: top + 100 };
});

describe('moveId', () => {
  it('moves an id forward and back', () => {
    expect(moveId(['a', 'b', 'c', 'd'], 'a', 2)).toEqual(['b', 'c', 'a', 'd']);
    expect(moveId(['a', 'b', 'c', 'd'], 'd', 0)).toEqual(['d', 'a', 'b', 'c']);
  });

  it('clamps the target', () => {
    expect(moveId(['a', 'b'], 'a', 9)).toEqual(['b', 'a']);
  });
});

describe('indexAtPoint', () => {
  it('finds the cell under the pointer, and none over a gap', () => {
    expect(indexAtPoint(grid, 130, 130)).toBe(4);
    expect(indexAtPoint(grid, 110, 50)).toBe(-1);
  });

  it('skips cells not laid out', () => {
    expect(indexAtPoint([null, grid[1] ?? null], 130, 10)).toBe(1);
  });
});

describe('columnCount', () => {
  it('counts the cells on the first row', () => {
    expect(columnCount(grid)).toBe(3);
    expect(columnCount([])).toBe(1);
  });
});

describe('keyboardTarget', () => {
  it('moves by one across and a row up or down, within the list', () => {
    expect(keyboardTarget(4, 'ArrowRight', 3, 7)).toBe(5);
    expect(keyboardTarget(4, 'ArrowUp', 3, 7)).toBe(1);
    expect(keyboardTarget(4, 'ArrowDown', 3, 7)).toBe(6);
    expect(keyboardTarget(0, 'ArrowLeft', 3, 7)).toBe(0);
    expect(keyboardTarget(4, 'End', 3, 7)).toBe(6);
    expect(keyboardTarget(4, 'Home', 3, 7)).toBe(0);
  });
});

describe('edgeScroll', () => {
  it('scrolls faster nearer an edge, and not in the middle', () => {
    expect(edgeScroll(500, 1000, 100, 20)).toBe(0);
    expect(edgeScroll(50, 1000, 100, 20)).toBe(-10);
    expect(edgeScroll(0, 1000, 100, 20)).toBe(-20);
    expect(edgeScroll(1000, 1000, 100, 20)).toBe(20);
  });
});

describe('withArrivals', () => {
  it('keeps the drag order, drops ids that left and adds new ones at the end', () => {
    expect(withArrivals(['c', 'a', 'b'], ['a', 'c', 'd'])).toEqual(['c', 'a', 'd']);
  });
});
