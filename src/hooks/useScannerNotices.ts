import {
  describeScannerNotice,
  scannerNotices,
  type ScannerNoticeText,
} from '../shared/scannerNotices';
import { useScannerStatus } from './useScannerStatus';

/**
 * Polls the scanner and says why it isn't making progress, if it isn't. None until the status
 * has loaded; each poll re-renders, which keeps the "resumes in" countdowns current.
 */
export function useScannerNotices(pollMs: number): ScannerNoticeText[] {
  const view = useScannerStatus(pollMs);
  if (view.state !== 'ready') return [];
  const now = Date.now();
  return scannerNotices(view.status).map((notice) => describeScannerNotice(notice, now));
}
