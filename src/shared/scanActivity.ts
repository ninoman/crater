// What the scanner is doing for the lists built from crate mates, from its status, so an empty
// list can show work in progress instead of a dead end.

import type { ScannerStatus } from './scan';

export type ScanActivity =
  | { kind: 'scanning'; releases: { scanned: number; total: number }; fansRead: number }
  /** Work is queued but nothing is sent: paused, out of budget, backing off or a parser error. */
  | { kind: 'stopped'; releases: { scanned: number; total: number }; fansRead: number }
  /** Nothing queued, so an empty list will stay empty for now. */
  | { kind: 'idle' };

export function scanActivity(status: ScannerStatus): ScanActivity {
  if (status.queued.release + status.queued.fan === 0) return { kind: 'idle' };
  const progress = { releases: status.ownReleases, fansRead: status.fansScanned };
  return status.pause || status.parserError
    ? { kind: 'stopped', ...progress }
    : { kind: 'scanning', ...progress };
}

/** "12 of 903 releases scanned · 40 fans read", without the half that has nothing yet. */
export function formatScanLine({
  releases,
  fansRead,
}: {
  releases: { scanned: number; total: number };
  fansRead: number;
}): string {
  const parts = [
    releases.total > 0 ? `${releases.scanned} of ${releases.total} releases scanned` : null,
    fansRead > 0 ? `${fansRead} ${fansRead === 1 ? 'fan' : 'fans'} read` : null,
  ];
  return parts.filter((part) => part !== null).join(' · ');
}
