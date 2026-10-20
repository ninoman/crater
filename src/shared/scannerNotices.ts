// Why the scanner isn't making progress, as notices every view shows the same way.

import type { ScannerStatus } from './scan';
import { clockTime, timeUntil } from './timeAgo';

export type ScannerNotice =
  | { kind: 'parser-broken' }
  /** `retryAt` is null when the browser says it's offline but no request has failed yet. */
  | { kind: 'offline'; retryAt: number | null }
  | { kind: 'backoff'; until: number }
  | { kind: 'budget'; until: number; limit: number }
  | { kind: 'paused-by-you' };

export type ScannerNoticeKind = ScannerNotice['kind'];

/** Most important first. A broken parser outlasts any pause, so it leads. */
export function scannerNotices(status: ScannerStatus): ScannerNotice[] {
  const { pause, online, parserError, dailyBudget } = status;
  const notices: ScannerNotice[] = [];
  if (parserError !== null) notices.push({ kind: 'parser-broken' });

  const retryAt = pause?.reason === 'offline' || pause?.reason === 'backoff' ? pause.until : null;
  // Offline, any back-off is ours, not Bandcamp asking.
  if (!online || pause?.reason === 'offline') notices.push({ kind: 'offline', retryAt });
  else if (pause?.reason === 'backoff') notices.push({ kind: 'backoff', until: pause.until });

  if (pause?.reason === 'budget') {
    notices.push({ kind: 'budget', until: pause.until, limit: dailyBudget });
  }
  if (pause?.reason === 'manual') notices.push({ kind: 'paused-by-you' });
  return notices;
}

export interface ScannerNoticeText {
  id: ScannerNoticeKind;
  tone: 'warning' | 'error';
  title: string;
  detail: string;
}

function resumes(at: number, now: number): string {
  return `${clockTime(at)} (${timeUntil(at, now)})`;
}

export function describeScannerNotice(notice: ScannerNotice, now: number): ScannerNoticeText {
  const id = notice.kind;
  switch (notice.kind) {
    case 'parser-broken':
      return {
        id,
        tone: 'error',
        title: 'Parser broken.',
        detail:
          "Bandcamp changed something Dighead reads, so scanning has stopped and results won't update. Dighead needs an update.",
      };
    case 'offline':
      return {
        id,
        tone: 'warning',
        title: "You're offline.",
        detail:
          notice.retryAt === null
            ? 'Scanning carries on once you’re back online.'
            : `Scanning carries on once you’re back online. Next try at ${resumes(notice.retryAt, now)}.`,
      };
    case 'backoff':
      return {
        id,
        tone: 'warning',
        title: 'Queue paused.',
        detail: `Bandcamp asked Dighead to slow down. Resumes at ${resumes(notice.until, now)}.`,
      };
    case 'budget':
      return {
        id,
        tone: 'warning',
        title: 'Daily budget reached.',
        detail: `Dighead has sent today's ${notice.limit.toLocaleString('en')} requests. Resumes at midnight (${timeUntil(notice.until, now)}).`,
      };
    case 'paused-by-you':
      return {
        id,
        tone: 'warning',
        title: 'Scanner paused.',
        detail: 'Nothing is scanned until you resume it from the Dighead popup.',
      };
  }
}
