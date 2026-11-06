import {
  describeScannerNotice,
  scannerNotices,
  type ScannerNotice,
} from '../shared/scannerNotices';
import type { NoticeAction, NoticeItem } from '../ui';
import { useCopyDiagnostics, type CopyDiagnostics } from './useCopyDiagnostics';
import { useScannerControls, type ScannerControls } from './useScannerControls';
import { useScannerStatus } from './useScannerStatus';

const COPY_LABELS = {
  idle: 'Copy diagnostics',
  working: 'Copying…',
  copied: 'Copied',
  error: 'Couldn’t copy',
} as const;

/**
 * What you can do about a notice, right in it. Resuming is what clears a wait on unanswered
 * requests, so it doubles as the retry. A broken parser may have been a passing glitch, so its
 * failed job can run again; if it still fails, a report is what gets it fixed.
 */
function noticeActions(
  notice: ScannerNotice,
  controls: ScannerControls,
  diagnostics: CopyDiagnostics,
): NoticeAction[] {
  switch (notice.kind) {
    case 'unreachable':
      return [{ label: 'Try again', onClick: controls.resume, disabled: controls.pending }];
    case 'parser-broken':
      return [
        {
          label: notice.retrying ? 'Retrying…' : 'Try again',
          onClick: controls.retryParser,
          disabled: notice.retrying || controls.pending,
        },
        {
          label: COPY_LABELS[diagnostics.status.state],
          onClick: diagnostics.copy,
          disabled: diagnostics.status.state === 'working',
        },
      ];
    default:
      return [];
  }
}

/** A notice as the banner shows it, with what you can do about it. */
export function toNoticeItem(
  notice: ScannerNotice,
  now: number,
  controls: ScannerControls,
  diagnostics: CopyDiagnostics,
): NoticeItem {
  const actions = noticeActions(notice, controls, diagnostics);
  const text = describeScannerNotice(notice, now);
  return actions.length > 0 ? { ...text, actions } : text;
}

/**
 * Polls the scanner and says why it isn't making progress, if it isn't. None until the status
 * has loaded; each poll re-renders, which keeps the "resumes in" countdowns current.
 */
export function useScannerNotices(pollMs: number): NoticeItem[] {
  const view = useScannerStatus(pollMs);
  const controls = useScannerControls(view.refresh);
  const diagnostics = useCopyDiagnostics();
  if (view.state !== 'ready') return [];
  const now = Date.now();
  return scannerNotices(view.status).map((notice) =>
    toNoticeItem(notice, now, controls, diagnostics),
  );
}
