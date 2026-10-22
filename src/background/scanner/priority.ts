// Queue priorities, most urgent first (decisions §5).

/** The release open in the most recent tab, and its supporters. */
export const FOREGROUND = 1;
/** Releases opened earlier, and their supporters. */
export const BACKGROUND = 2;
/**
 * Latest reads of your top lately twins (decisions §11): after anything you opened, before the
 * seed backlog, which can take days and would hold them up. A fraction, so SEED's stored value
 * stays as it is.
 */
export const LATELY_RESCAN = 2.5;
/** Your own releases, queued after each sync of your collection, and their supporters. */
export const SEED = 3;

// Ranks order jobs within one priority and place in line (decisions §12). A release job is 0,
// so its supporter list is in before any of its fans run; fans waiting for a profile hold their
// pass-0 place, 1 to the supporter cap.

/** A profiled fan who reads behind every profile still waiting. */
export const DEFERRED_RANK = 1_000_000;
/** A full scan, after every quick read and profile of the same release. */
export const FULL_SCAN_RANK = 2_000_000;

/**
 * Where a profiled fan's collection read goes: before the profiles still waiting when it reads
 * ahead, else after them, best similarity first either way.
 */
export function profiledRank(similarity: number, ahead: boolean): number {
  const order = 1 / (1 + similarity);
  return ahead ? order : DEFERRED_RANK + order;
}
