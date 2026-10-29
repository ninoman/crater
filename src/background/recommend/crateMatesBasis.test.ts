import { describe, expect, it } from 'vitest';
import { recomputeDue } from './crateMatesBasis';

describe('recomputeDue', () => {
  it('runs before any recompute is recorded', () => {
    expect(recomputeDue(3, null, 15)).toBe(true);
  });

  it('waits for enough new fans since the last recompute', () => {
    expect(recomputeDue(205, 191, 15)).toBe(false);
    expect(recomputeDue(206, 191, 15)).toBe(true);
  });
});
