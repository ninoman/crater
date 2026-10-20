import { describe, expect, it } from 'vitest';
import type { Following } from '../../shared/following';
import {
  actionable,
  commonTagIds,
  isFiltering,
  liveTagIds,
  NO_FILTER,
  toggled,
  visibleIds,
} from './followingFilter';

function row(id: number, name: string, tagIds: number[] = []): Following {
  return {
    kind: 'band',
    id,
    name,
    url: `https://b${id}.bandcamp.com`,
    imageId: null,
    location: null,
    followedAt: 0,
    tagIds,
    unfollowed: false,
  };
}

const ROWS = [
  row(1, 'Björk', [1, 2]),
  row(2, 'Burial', [1]),
  row(3, 'Pearson Sound', [2]),
  row(4, 'Untagged'),
];
const ids = (set: Set<number>) => [...set].sort();

describe('visibleIds', () => {
  it('keeps everyone with no filter', () => {
    expect(ids(visibleIds(ROWS, NO_FILTER))).toEqual([1, 2, 3, 4]);
  });

  it('needs every selected tag in all mode', () => {
    expect(ids(visibleIds(ROWS, { ...NO_FILTER, tagIds: [1, 2] }))).toEqual([1]);
  });

  it('needs one selected tag in any mode', () => {
    expect(ids(visibleIds(ROWS, { tagIds: [1, 2], mode: 'any', query: '' }))).toEqual([1, 2, 3]);
  });

  it('searches names without case or accents, together with tags', () => {
    expect(ids(visibleIds(ROWS, { ...NO_FILTER, query: ' BJORK ' }))).toEqual([1]);
    expect(ids(visibleIds(ROWS, { ...NO_FILTER, query: 'ur' }))).toEqual([2]);
    expect(ids(visibleIds(ROWS, { tagIds: [2], mode: 'all', query: 'sound' }))).toEqual([3]);
  });
});

describe('isFiltering', () => {
  it('is on for tags or a query, not for the mode alone', () => {
    expect(isFiltering(NO_FILTER)).toBe(false);
    expect(isFiltering({ ...NO_FILTER, mode: 'any' })).toBe(false);
    expect(isFiltering({ ...NO_FILTER, query: '  ' })).toBe(false);
    expect(isFiltering({ ...NO_FILTER, query: 'x' })).toBe(true);
    expect(isFiltering({ ...NO_FILTER, tagIds: [1] })).toBe(true);
  });
});

describe('liveTagIds', () => {
  it('drops tags that were deleted', () => {
    expect(liveTagIds([1, 2, 3], [{ id: 3 }, { id: 1 }])).toEqual([1, 3]);
  });
});

describe('selection', () => {
  it('toggles ids without changing the original', () => {
    const start = new Set([1]);
    expect(ids(toggled(start, 2, true))).toEqual([1, 2]);
    expect(ids(toggled(start, 1, false))).toEqual([]);
    expect(ids(start)).toEqual([1]);
  });

  it('acts only on selected rows that are shown', () => {
    expect(actionable(new Set([1, 2, 3]), new Set([2, 3, 4]))).toEqual([2, 3]);
  });

  it('finds the tags every selected row has', () => {
    expect(commonTagIds(ROWS, [1, 2])).toEqual([1]);
    expect(commonTagIds(ROWS, [1, 3])).toEqual([2]);
    expect(commonTagIds(ROWS, [1, 4])).toEqual([]);
    expect(commonTagIds(ROWS, [])).toEqual([]);
  });
});
