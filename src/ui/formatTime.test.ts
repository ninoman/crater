import { describe, expect, it } from 'vitest';
import { formatTime } from './formatTime';

describe('formatTime', () => {
  it('formats seconds as m:ss', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(9.7)).toBe('0:09');
    expect(formatTime(384.152)).toBe('6:24');
    expect(formatTime(3600)).toBe('60:00');
  });

  it('treats unknown durations as zero', () => {
    expect(formatTime(Number.NaN)).toBe('0:00');
    expect(formatTime(Number.POSITIVE_INFINITY)).toBe('0:00');
  });
});
