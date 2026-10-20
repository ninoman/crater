import { describe, expect, it } from 'vitest';
import { matchesTags } from './tagFilter';

describe('matchesTags', () => {
  it('keeps everything when no tag is selected', () => {
    expect(matchesTags([], [], 'all')).toBe(true);
    expect(matchesTags([1], [], 'any')).toBe(true);
  });

  it('needs every selected tag in all mode', () => {
    expect(matchesTags([1, 2, 3], [1, 3], 'all')).toBe(true);
    expect(matchesTags([1, 2], [1, 3], 'all')).toBe(false);
  });

  it('needs one selected tag in any mode', () => {
    expect(matchesTags([2, 3], [1, 3], 'any')).toBe(true);
    expect(matchesTags([2], [1, 3], 'any')).toBe(false);
  });
});
