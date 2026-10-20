import { describe, expect, it } from 'vitest';
import { tagColor } from './tag';

describe('tagColor', () => {
  it('gives the first eight ids (Dexie starts at 1) eight different colours', () => {
    const colors = [1, 2, 3, 4, 5, 6, 7, 8].map(tagColor);
    expect(colors[0]).toBe('var(--dh-tag-1)');
    expect(colors[7]).toBe('var(--dh-tag-8)');
    expect(new Set(colors).size).toBe(8);
  });

  it('wraps around after eight', () => {
    expect(tagColor(9)).toBe(tagColor(1));
    expect(tagColor(20)).toBe(tagColor(4));
  });

  it('always returns one of the tokens, even for odd ids', () => {
    for (const id of [0, -3, 2.7, 1_000_003]) {
      expect(tagColor(id)).toMatch(/^var\(--dh-tag-[1-8]\)$/);
    }
  });
});
