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

describe('homePlace', () => {
  it('is empty by default, and accepts text up to a limit', () => {
    expect(DEFAULT_SETTINGS.homePlace).toBe('');
    expect(validateSettings({ ...DEFAULT_SETTINGS, homePlace: 'Berlin, Germany' })).toEqual({});
    expect(validateSettings({ ...DEFAULT_SETTINGS, homePlace: 'x'.repeat(101) })).toEqual({
      homePlace: 'At most 100 characters',
    });
  });

  it('is read back from storage as text only', () => {
    expect(sanitizeSettings({ homePlace: 'Leipzig' }).homePlace).toBe('Leipzig');
    expect(sanitizeSettings({ homePlace: 5 }).homePlace).toBe('');
  });
});

describe('sanitizeSettings', () => {
  it('fills in defaults for anything missing', () => {
    expect(sanitizeSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSettings({ topCrateMatesK: 50 })).toEqual({
      ...DEFAULT_SETTINGS,
      topCrateMatesK: 50,
    });
  });

  it('drops values of the wrong type or out of range', () => {
    expect(
      sanitizeSettings({
        topCrateMatesK: '50',
        dailyRequestBudget: -1,
        labelClusterDownweight: false,
      }),
    ).toEqual({ ...DEFAULT_SETTINGS, labelClusterDownweight: false });
  });

  it('keeps values saved under their names from before the crate mates rename', () => {
    expect(sanitizeSettings({ topTwinsK: 50, latelyRescanTwins: 10 })).toEqual({
      ...DEFAULT_SETTINGS,
      topCrateMatesK: 50,
      latelyRescanCrateMates: 10,
    });
  });

  it('falls back to all defaults when a kept value clashes with a reset one', () => {
    // paceMaxMs resets to 3000, which is below the stored minimum.
    expect(sanitizeSettings({ paceMinMs: 5000, paceMaxMs: 'x' })).toEqual(DEFAULT_SETTINGS);
  });
});
