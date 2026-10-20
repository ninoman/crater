import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, sanitizeSettings, validateSettings } from './settings';

describe('validateSettings', () => {
  it('accepts the defaults', () => {
    expect(validateSettings(DEFAULT_SETTINGS)).toEqual({});
  });

  it('rejects fractions, out-of-range values and inverted pairs', () => {
    expect(
      validateSettings({
        ...DEFAULT_SETTINGS,
        paceMinMs: 500,
        collectionBatchSize: 20.5,
        minCollectionSize: 900,
        maxCollectionSize: 800,
      }),
    ).toEqual({
      paceMinMs: 'Between 1000 and 60000',
      collectionBatchSize: 'Enter a whole number',
      maxCollectionSize: 'At least the minimum size',
    });
    expect(validateSettings({ ...DEFAULT_SETTINGS, paceMinMs: 4000, paceMaxMs: 3000 })).toEqual({
      paceMaxMs: 'At least the minimum pace',
    });
  });
});

describe('sanitizeSettings', () => {
  it('fills in defaults for anything missing', () => {
    expect(sanitizeSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSettings({ topTwinsK: 50 })).toEqual({ ...DEFAULT_SETTINGS, topTwinsK: 50 });
  });

  it('drops values of the wrong type or out of range', () => {
    expect(
      sanitizeSettings({ topTwinsK: '50', dailyRequestBudget: -1, labelClusterDownweight: false }),
    ).toEqual({ ...DEFAULT_SETTINGS, labelClusterDownweight: false });
  });

  it('falls back to all defaults when a kept value clashes with a reset one', () => {
    // paceMaxMs resets to 3000, which is below the stored minimum.
    expect(sanitizeSettings({ paceMinMs: 5000, paceMaxMs: 'x' })).toEqual(DEFAULT_SETTINGS);
  });
});
