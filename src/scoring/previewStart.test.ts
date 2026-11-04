import { describe, expect, it } from 'vitest';
import type { ItemKey } from '../bandcamp';
import { previewStartIndex } from './previewStart';

const tracks = (['t1', 't2', 't3'] as ItemKey[]).map((itemKey) => ({ itemKey }));

describe('previewStartIndex', () => {
  it('starts at the track the most fans bought on its own', () => {
    const buyers = new Map<ItemKey, number>([
      ['t1', 1],
      ['t3', 4],
    ]);
    expect(previewStartIndex(tracks, buyers, 1)).toBe(2);
  });

  it('breaks a tie towards the earlier track', () => {
    const buyers = new Map<ItemKey, number>([
      ['t3', 2],
      ['t2', 2],
    ]);
    expect(previewStartIndex(tracks, buyers, 0)).toBe(1);
  });

  it('keeps the featured track when nobody bought one on its own', () => {
    expect(previewStartIndex(tracks, new Map(), 1)).toBe(1);
  });

  it('skips tracks the page gives no key for', () => {
    const buyers = new Map<ItemKey, number>([['t2', 3]]);
    expect(previewStartIndex([{ itemKey: null }, ...tracks], buyers, 0)).toBe(2);
  });
});
