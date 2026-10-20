import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BACKOFF_MAX_MS,
  backoffDelayMs,
  jobRetryAt,
  nextBackoff,
  parseRetryAfter,
} from './backoff';
import { budgetExhausted, localDay, nextLocalMidnight, spend, usedToday } from './budget';
import { FAN_FRESH_MS, needsFanScan, supportersAreFresh, SUPPORTERS_FRESH_MS } from './freshness';
import { canTakeLock, LOCK_TTL_MS } from './lock';
import { paceWaitMs } from './pace';
import { INITIAL_SCANNER_STATE, pauseFor } from './state';

// Local wall-clock times, so these hold in any time zone.
const EVENING = new Date(2026, 9, 20, 23, 59, 30).getTime();
const NEXT_MORNING = new Date(2026, 9, 21, 0, 0, 5).getTime();

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(EVENING);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('backoff', () => {
  it('reads Retry-After as seconds or as an HTTP date', () => {
    const now = Date.now();
    expect(parseRetryAfter('120', now)).toBe(120_000);
    expect(parseRetryAfter(new Date(now + 90_000).toUTCString(), now)).toBe(90_000);
    expect(parseRetryAfter(new Date(now - 5_000).toUTCString(), now)).toBe(0);
    expect(parseRetryAfter('soon', now)).toBeNull();
    expect(parseRetryAfter(null, now)).toBeNull();
  });

  it('doubles from 60 s, up to an hour', () => {
    expect([1, 2, 3, 4].map((n) => backoffDelayMs(n, null))).toEqual([
      60_000, 120_000, 240_000, 480_000,
    ]);
    expect(backoffDelayMs(20, null)).toBe(BACKOFF_MAX_MS);
  });

  it("prefers the server's Retry-After", () => {
    expect(backoffDelayMs(5, 7_000)).toBe(7_000);
  });

  it('counts consecutive failures', () => {
    const now = Date.now();
    const first = nextBackoff(null, null, now);
    const second = nextBackoff(first, null, now);

    expect(first).toEqual({ failures: 1, until: now + 60_000 });
    expect(second).toEqual({ failures: 2, until: now + 120_000 });
  });

  it('retries a failing job twice, then drops it', () => {
    expect(jobRetryAt(0, 0)).toBe(60_000);
    expect(jobRetryAt(1, 0)).toBe(120_000);
    expect(jobRetryAt(2, 0)).toBeNull();
  });
});

describe('budget', () => {
  it('resets at local midnight', () => {
    let budget = spend(null, Date.now());
    budget = spend(budget, Date.now());
    expect(usedToday(budget, Date.now())).toBe(2);
    expect(budgetExhausted(budget, 2, Date.now())).toBe(true);

    vi.setSystemTime(NEXT_MORNING);

    expect(usedToday(budget, Date.now())).toBe(0);
    expect(budgetExhausted(budget, 2, Date.now())).toBe(false);
    expect(spend(budget, Date.now())).toEqual({ day: '2026-10-21', used: 1 });
  });

  it('knows when the next local midnight is', () => {
    expect(localDay(EVENING)).toBe('2026-10-20');
    expect(nextLocalMidnight(EVENING)).toBe(new Date(2026, 9, 21).getTime());
  });
});

describe('pauseFor', () => {
  it('pauses for back-off first, then for the budget, else runs', () => {
    const now = Date.now();
    const spent = { day: localDay(now), used: 3 };

    expect(
      pauseFor(
        { ...INITIAL_SCANNER_STATE, backoff: { until: now + 1, failures: 1 }, budget: spent },
        3,
        now,
      ),
    ).toEqual({ reason: 'backoff', until: now + 1 });
    expect(
      pauseFor(
        { ...INITIAL_SCANNER_STATE, backoff: { until: now, failures: 1 }, budget: spent },
        3,
        now,
      ),
    ).toEqual({ reason: 'budget', until: nextLocalMidnight(now) });
    expect(pauseFor({ ...INITIAL_SCANNER_STATE, budget: spent }, 4, now)).toBeNull();
  });
});

describe('freshness', () => {
  it('rescans fans after 30 days, and never-scanned fans at once', () => {
    const now = Date.now();
    expect(needsFanScan(undefined, now)).toBe(true);
    expect(needsFanScan({ collectionFetchedAt: null }, now)).toBe(true);
    expect(needsFanScan({ collectionFetchedAt: now - FAN_FRESH_MS + 1 }, now)).toBe(false);
    expect(needsFanScan({ collectionFetchedAt: now - FAN_FRESH_MS }, now)).toBe(true);
  });

  it('reuses a supporter list for 7 days', () => {
    const now = Date.now();
    expect(supportersAreFresh(undefined, now)).toBe(false);
    expect(supportersAreFresh({ fetchedAt: now - SUPPORTERS_FRESH_MS + 1 }, now)).toBe(true);
    expect(supportersAreFresh({ fetchedAt: now - SUPPORTERS_FRESH_MS }, now)).toBe(false);
  });
});

describe('pace', () => {
  const pace = { paceMinMs: 1500, paceMaxMs: 3000 };

  it('waits a random 1.5–3 s after the last request', () => {
    expect(paceWaitMs(1000, pace, () => 0, 1000)).toBe(1500);
    expect(paceWaitMs(1000, pace, () => 1, 1000)).toBe(3000);
    expect(paceWaitMs(1000, pace, () => 0.5, 2000)).toBe(1250);
  });

  it("doesn't wait when the last request was long ago or never", () => {
    expect(paceWaitMs(0, pace, () => 1, 10_000)).toBe(0);
    expect(paceWaitMs(null, pace, () => 1, 10_000)).toBe(0);
  });
});

describe('lock', () => {
  it('is free, ours, or stale', () => {
    const now = Date.now();
    expect(canTakeLock(null, 'me', now)).toBe(true);
    expect(canTakeLock({ owner: 'me', heartbeatAt: now }, 'me', now)).toBe(true);
    expect(canTakeLock({ owner: 'old', heartbeatAt: now }, 'me', now)).toBe(false);
    expect(canTakeLock({ owner: 'old', heartbeatAt: now - LOCK_TTL_MS - 1 }, 'me', now)).toBe(true);
  });
});
