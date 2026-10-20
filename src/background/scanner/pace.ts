import type { Settings } from '../../shared/settings';

type Pace = Pick<Settings, 'paceMinMs' | 'paceMaxMs'>;

/** A random gap between two requests, within the configured pace. */
export function paceDelayMs({ paceMinMs, paceMaxMs }: Pace, random: () => number): number {
  return paceMinMs + random() * (paceMaxMs - paceMinMs);
}

/** How long to wait before the next request, given when the last one was sent. */
export function paceWaitMs(
  lastRequestAt: number | null,
  pace: Pace,
  random: () => number,
  now: number,
): number {
  if (lastRequestAt === null) return 0;
  return Math.max(0, lastRequestAt + paceDelayMs(pace, random) - now);
}
