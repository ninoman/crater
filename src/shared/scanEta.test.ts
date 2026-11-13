import { describe, expect, it } from 'vitest';
import {
  addSample,
  etaMs,
  FIRST_FANS_AFTER_LISTS,
  formatEta,
  listsUntilFans,
  SAMPLE_WINDOW_MS,
} from './scanEta';

describe('listsUntilFans', () => {
  it('counts to the first fans, or to the end for a small collection', () => {
    expect(listsUntilFans(30, 900)).toBe(FIRST_FANS_AFTER_LISTS - 30);
    expect(listsUntilFans(150, 900)).toBe(0);
    expect(listsUntilFans(10, 40)).toBe(30);
  });
});

describe('etaMs', () => {
  it('extends the pace seen so far', () => {
    const samples = [
      { at: 0, scanned: 0 },
      { at: 60_000, scanned: 6 },
    ];
    expect(etaMs(samples, 30)).toBe(300_000);
  });

  it('says nothing without enough time or progress', () => {
    expect(etaMs([{ at: 0, scanned: 0 }], 10)).toBeNull();
    expect(
      etaMs(
        [
          { at: 0, scanned: 0 },
          { at: 10_000, scanned: 5 },
        ],
        10,
      ),
    ).toBeNull();
    expect(
      etaMs(
        [
          { at: 0, scanned: 4 },
          { at: 60_000, scanned: 4 },
        ],
        10,
      ),
    ).toBeNull();
    expect(
      etaMs(
        [
          { at: 0, scanned: 0 },
          { at: 60_000, scanned: 5 },
        ],
        0,
      ),
    ).toBeNull();
  });
});

describe('addSample', () => {
  it('drops samples older than the window', () => {
    const old = { at: 0, scanned: 1 };
    const next = { at: SAMPLE_WINDOW_MS + 1, scanned: 2 };
    expect(addSample([old], next)).toEqual([next]);
  });

  it('starts over when the count goes down', () => {
    const next = { at: 10, scanned: 0 };
    expect(addSample([{ at: 0, scanned: 5 }], next)).toEqual([next]);
  });
});

describe('formatEta', () => {
  it('rounds to minutes, then hours', () => {
    expect(formatEta(20_000)).toBe('under a minute');
    expect(formatEta(12 * 60_000)).toBe('about 12 min');
    expect(formatEta(150 * 60_000)).toBe('about 3 h');
  });
});
