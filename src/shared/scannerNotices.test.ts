import { describe, expect, it } from 'vitest';
import type { ScannerStatus } from './scan';
import { describeScannerNotice, scannerNotices } from './scannerNotices';

const NOW = new Date(2026, 9, 20, 14, 0).getTime();
const MIDNIGHT = new Date(2026, 9, 21).getTime();

function status(patch: Partial<ScannerStatus> = {}): ScannerStatus {
  return {
    queued: { release: 0, fan: 3 },
    fansScanned: 10,
    ownReleases: { scanned: 0, total: 0 },
    requestsToday: 5,
    dailyBudget: 3000,
    paceFactor: 1,
    pause: null,
    online: true,
    lastError: null,
    parserError: null,
    ...patch,
  };
}

describe('scannerNotices', () => {
  it('says nothing while the scanner runs', () => {
    expect(scannerNotices(status())).toEqual([]);
  });

  it('maps each pause to its notice', () => {
    expect(scannerNotices(status({ pause: { reason: 'backoff', until: NOW + 1 } }))).toEqual([
      { kind: 'backoff', until: NOW + 1 },
    ]);
    expect(scannerNotices(status({ pause: { reason: 'offline', until: NOW + 1 } }))).toEqual([
      { kind: 'unreachable', retryAt: NOW + 1 },
    ]);
    expect(scannerNotices(status({ pause: { reason: 'budget', until: MIDNIGHT } }))).toEqual([
      { kind: 'budget', until: MIDNIGHT, limit: 3000 },
    ]);
    expect(scannerNotices(status({ pause: { reason: 'manual' } }))).toEqual([
      { kind: 'paused-by-you' },
    ]);
  });

  it('reports offline before any request has failed', () => {
    expect(scannerNotices(status({ online: false }))).toEqual([{ kind: 'offline', retryAt: null }]);
  });

  it("treats a back-off while offline as ours, not Bandcamp's", () => {
    expect(
      scannerNotices(status({ online: false, pause: { reason: 'backoff', until: NOW + 1 } })),
    ).toEqual([{ kind: 'offline', retryAt: NOW + 1 }]);
  });

  it('only says offline when the browser does', () => {
    expect(
      scannerNotices(status({ online: false, pause: { reason: 'offline', until: NOW + 1 } })),
    ).toEqual([{ kind: 'offline', retryAt: NOW + 1 }]);
  });

  it('puts a broken parser first and keeps the pause too', () => {
    expect(
      scannerNotices(
        status({ parserError: 'fan 7: bad', pause: { reason: 'budget', until: MIDNIGHT } }),
      ).map(({ kind }) => kind),
    ).toEqual(['parser-broken', 'budget']);
  });
});

describe('describeScannerNotice', () => {
  it('marks a broken parser as an error and pauses as warnings', () => {
    expect(describeScannerNotice({ kind: 'parser-broken' }, NOW).tone).toBe('error');
    expect(describeScannerNotice({ kind: 'paused-by-you' }, NOW).tone).toBe('warning');
  });

  it('says when a back-off ends and how long that is', () => {
    const { title, detail } = describeScannerNotice(
      { kind: 'backoff', until: NOW + 12 * 60_000 },
      NOW,
    );
    expect(title).toBe('Queue paused.');
    expect(detail).toContain('in 12 minutes');
  });

  it('gives the next retry when offline, if there is one', () => {
    expect(describeScannerNotice({ kind: 'offline', retryAt: null }, NOW).detail).not.toContain(
      'Next try',
    );
    expect(describeScannerNotice({ kind: 'offline', retryAt: NOW + 90_000 }, NOW).detail).toContain(
      '(in 2 minutes)',
    );
  });

  it("doesn't blame your connection when requests fail while online", () => {
    const { title, detail } = describeScannerNotice(
      { kind: 'unreachable', retryAt: NOW + 90_000 },
      NOW,
    );
    expect(title).not.toContain('offline');
    expect(detail).toContain('(in 2 minutes)');
  });

  it('names the budget and the time until midnight', () => {
    const { detail } = describeScannerNotice({ kind: 'budget', until: MIDNIGHT, limit: 3000 }, NOW);
    expect(detail).toContain("today's 3,000 requests");
    expect(detail).toContain('midnight (in 10 hours)');
  });
});
