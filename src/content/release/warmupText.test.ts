import { describe, expect, it } from 'vitest';
import { formatWarmup } from './warmupText';

const warmup = { read: 12, readTarget: 20, confident: 3, confidentTarget: 5 };

describe('warm-up text', () => {
  it('names the read target when it is short of the whole scan', () => {
    expect(formatWarmup(warmup, 500)).toBe('3 of 5 strong picks · needs 20 supporters read');
  });

  it('leaves the target out when the wait is for every supporter', () => {
    expect(formatWarmup({ ...warmup, read: 4, readTarget: 7 }, 7)).toBe('3 of 5 strong picks');
  });

  it('leaves the target out once it is met', () => {
    expect(formatWarmup({ ...warmup, read: 20 }, 500)).toBe('3 of 5 strong picks');
  });

  it('leaves the target out before the scan total is known', () => {
    expect(formatWarmup(warmup, null)).toBe('3 of 5 strong picks');
  });
});
