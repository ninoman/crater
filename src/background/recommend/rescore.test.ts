import { describe, expect, it } from 'vitest';
import { rescoreDue } from './rescore';

const progress = (scanned: number, total: number) => ({
  releaseKey: 'a1' as const,
  scanned,
  total,
  listed: true,
});

describe('rescoreDue', () => {
  it('re-scores after every fan for the first 20 supporters', () => {
    expect(rescoreDue('fan', 1, progress(1, 48))).toBe(true);
    expect(rescoreDue('fan', 1, progress(19, 48))).toBe(true);
  });

  it('re-scores every 5 fans after that', () => {
    expect(rescoreDue('fan', 4, progress(24, 48))).toBe(false);
    expect(rescoreDue('fan', 5, progress(25, 48))).toBe(true);
  });

  it('re-scores when the last supporter is scanned', () => {
    expect(rescoreDue('fan', 2, progress(48, 48))).toBe(true);
  });

  it('re-scores once the supporter list is complete', () => {
    expect(rescoreDue('release', 0, progress(0, 48))).toBe(true);
  });
});
