import { describe, expect, it } from 'vitest';
import { formatWarmup, warmupFill } from './warmupText';

const warmup = { read: 12, readTarget: 20, confident: 3, confidentTarget: 5 };

describe('warm-up text', () => {
  it('says how far both halves of the wait have got', () => {
    expect(formatWarmup(warmup)).toBe('12 of 20 supporters read · 3 of 5 strong picks');
  });

  it('fills the bar only when both are met', () => {
    expect(warmupFill(warmup)).toEqual({ value: 15, max: 25 });
    expect(warmupFill({ ...warmup, read: 20 })).toEqual({ value: 23, max: 25 });
  });
});
