// Shapes of scanner state, shared by the worker and the UI.

import type { ItemKey } from '../bandcamp';

/** How far the scan of one release's supporters has got. Broadcast as fans finish. */
export interface ScanProgress {
  releaseKey: ItemKey;
  /** Supporters whose collection has been read (or found private). */
  scanned: number;
  /** Supporters listed so far, up to the per-release cap. */
  total: number;
  /** False until the release page itself has been fetched, so 0 / 0 means "not started". */
  listed: boolean;
}

/** Why the scanner isn't sending requests right now. `until` is ms since epoch. */
export type ScannerPause =
  | { reason: 'manual' }
  | { reason: 'import' }
  | { reason: 'backoff'; until: number }
  /** A request got no answer: retried at `until`, with the same back-off as Bandcamp pushing back. */
  | { reason: 'offline'; until: number }
  | { reason: 'budget'; until: number };

export interface ScannerStatus {
  queued: { release: number; fan: number };
  /** Fans whose scan has ended, whatever the outcome. With `queued.fan`, the queue's progress. */
  fansScanned: number;
  /** Releases you own whose supporters have been listed, out of all you own (one per matchKey). */
  ownReleases: { scanned: number; total: number };
  requestsToday: number;
  dailyBudget: number;
  pause: ScannerPause | null;
  /** The browser's own guess at a network connection, as the worker sees it. */
  online: boolean;
  lastError: string | null;
  /** Set while Bandcamp data fails to parse: Crater needs an update. */
  parserError: string | null;
}

/** What queueing a release on request did: added, was already waiting, or its supporters are recent enough. */
export type QueueReleaseStatus = 'queued' | 'already-queued' | 'fresh';
