// When the first crate mates will show up, from how fast supporter lists have been read. Pure.

/**
 * Once this many of your seed lists are in, the best fans so far are read ahead of the rest of
 * the lists (scanner/seedFans.ts), so this is where the first crate mates start to come.
 */
export const FIRST_FANS_AFTER_LISTS = 100;

/** Seed lists still to read before fans are, or 0 once they are. */
export function listsUntilFans(scanned: number, total: number): number {
  return Math.max(0, Math.min(total, FIRST_FANS_AFTER_LISTS) - scanned);
}

export interface ScanSample {
  at: number;
  scanned: number;
}

/** Samples older than this don't say how fast the scanner is now. */
export const SAMPLE_WINDOW_MS = 5 * 60_000;
/** Too short a stretch of samples gives a wild guess. */
const MIN_SPAN_MS = 30_000;

/** Keeps the recent samples, adding `next`. A reset (fewer scanned than before) starts over. */
export function addSample(samples: ScanSample[], next: ScanSample): ScanSample[] {
  const last = samples.at(-1);
  if (last && next.scanned < last.scanned) return [next];
  return [...samples, next].filter((sample) => next.at - sample.at <= SAMPLE_WINDOW_MS);
}

/** Milliseconds until `remaining` more lists are read at the recent pace, or null if unknown. */
export function etaMs(samples: ScanSample[], remaining: number): number | null {
  const first = samples[0];
  const last = samples.at(-1);
  if (!first || !last || remaining <= 0) return null;
  const span = last.at - first.at;
  const done = last.scanned - first.scanned;
  if (span < MIN_SPAN_MS || done <= 0) return null;
  return (remaining * span) / done;
}

/** "under a minute", "about 12 min", "about 2 h". */
export function formatEta(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  if (minutes < 1) return 'under a minute';
  if (minutes < 90) return `about ${minutes} min`;
  return `about ${Math.round(minutes / 60)} h`;
}
