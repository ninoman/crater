import type { JobKind } from '../../db';
import type { ScanProgress } from '../../shared/scan';

/** Re-score a watched release after this many of its supporters finish scanning. */
export const RESCORE_EVERY_FANS = 5;

/**
 * Whether a finished job calls for a fresh Also-bought list: every few fans, when the last
 * supporter is done, and when the supporter list itself is complete.
 */
export function rescoreDue(kind: JobKind, fansSinceScore: number, progress: ScanProgress): boolean {
  if (kind === 'release') return true;
  return fansSinceScore >= RESCORE_EVERY_FANS || progress.scanned >= progress.total;
}
