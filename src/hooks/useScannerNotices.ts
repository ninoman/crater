import {
  describeScannerNotice,
  scannerNotices,
  type ScannerNoticeText,
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
 * requests, so it doubles as the retry; a broken parser needs a report to fix.
 */
export function withAction(
  text: ScannerNoticeText,
  controls: ScannerControls,
  diagnostics: CopyDiagnostics,
): NoticeItem {
  const action: NoticeAction | null =
    text.id === 'unreachable'
      ? { label: 'Try again', onClick: controls.resume, disabled: controls.pending }
      : text.id === 'parser-broken'
        ? {
            label: COPY_LABELS[diagnostics.status.state],
            onClick: diagnostics.copy,
            disabled: diagnostics.status.state === 'working',
          }
        : null;
  return action ? { ...text, action } : text;
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
    withAction(describeScannerNotice(notice, now), controls, diagnostics),
  );
}
