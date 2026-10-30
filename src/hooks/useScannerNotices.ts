import {
  describeScannerNotice,
  scannerNotices,
  type ScannerNoticeText,
} from '../shared/scannerNotices';
import type { NoticeItem } from '../ui';
import { useScannerControls, type ScannerControls } from './useScannerControls';
import { useScannerStatus } from './useScannerStatus';

/** Resuming is what clears a wait on unanswered requests, so it doubles as the retry. */
export function withRetry(text: ScannerNoticeText, controls: ScannerControls): NoticeItem {
  if (text.id !== 'unreachable') return text;
  return {
    ...text,
    action: { label: 'Try again', onClick: controls.resume, disabled: controls.pending },
  };
}

/**
 * Polls the scanner and says why it isn't making progress, if it isn't. None until the status
 * has loaded; each poll re-renders, which keeps the "resumes in" countdowns current.
 */
export function useScannerNotices(pollMs: number): NoticeItem[] {
  const view = useScannerStatus(pollMs);
  const controls = useScannerControls(view.refresh);
  if (view.state !== 'ready') return [];
  const now = Date.now();
  return scannerNotices(view.status).map((notice) =>
    withRetry(describeScannerNotice(notice, now), controls),
  );
}
