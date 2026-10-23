import type { JobKind } from '../../db';
import { WARMUP_SUPPORTERS } from '../../scoring/alsoBought';
import type { ScanProgress } from '../../shared/scan';

/** Re-score a watched release after this many of its supporters finish scanning. */
export const RESCORE_EVERY_FANS = 5;

/**
 * Whether a finished job calls for a fresh Also-bought list: after every fan while the first
 * supporters come in (early picks change most then), every few fans after that, when the last
 * supporter is done, and when the supporter list itself is complete.
 */
export function rescoreDue(kind: JobKind, fansSinceScore: number, progress: ScanProgress): boolean {
  if (kind === 'release') return true;
  const every = progress.scanned < WARMUP_SUPPORTERS ? 1 : RESCORE_EVERY_FANS;
  return fansSinceScore >= every || progress.scanned >= progress.total;
}
