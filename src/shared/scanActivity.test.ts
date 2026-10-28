import { describe, expect, it } from 'vitest';
import type { ScannerStatus } from './scan';
import { formatScanLine, scanActivity } from './scanActivity';

const status: ScannerStatus = {
  queued: { release: 5, fan: 0 },
  fansScanned: 3,
  ownReleases: { scanned: 1, total: 6 },
  requestsToday: 0,
  dailyBudget: 10_000,
  paceFactor: 1,
  pause: null,
  online: true,
  lastError: null,
  parserError: null,
};

describe('scanActivity', () => {
  it('is scanning while work is queued and nothing stops it', () => {
    expect(scanActivity(status)).toEqual({
      kind: 'scanning',
      releases: { scanned: 1, total: 6 },
      fansRead: 3,
    });
  });

  it('is stopped by a pause or a parser error', () => {
    expect(scanActivity({ ...status, pause: { reason: 'budget', until: 1 } }).kind).toBe('stopped');
    expect(scanActivity({ ...status, parserError: 'broken' }).kind).toBe('stopped');
  });

  it('is idle with nothing queued, paused or not', () => {
    const none = { ...status, queued: { release: 0, fan: 0 } };
    expect(scanActivity(none)).toEqual({ kind: 'idle' });
    expect(scanActivity({ ...none, pause: { reason: 'manual' } })).toEqual({ kind: 'idle' });
  });
});

describe('formatScanLine', () => {
  it('leaves out the halves with nothing to count', () => {
    expect(formatScanLine({ releases: { scanned: 2, total: 9 }, fansRead: 1 })).toBe(
      '2 of 9 releases scanned · 1 fan read',
    );
    expect(formatScanLine({ releases: { scanned: 0, total: 9 }, fansRead: 0 })).toBe(
      '0 of 9 releases scanned',
    );
    expect(formatScanLine({ releases: { scanned: 0, total: 0 }, fansRead: 0 })).toBe('');
  });
});
