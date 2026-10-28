// Request pacing. The configured range is the starting point; the adaptive factor scales it down
// while Bandcamp keeps answering and back up when it pushes back (decisions §5).

import type { Settings } from '../../shared/settings';

type Pace = Pick<Settings, 'paceMinMs' | 'paceMaxMs'>;

/** Multiplies the configured wait. Below 1 is faster than configured. */
export interface AdaptivePace {
  factor: number;
  /** Requests sent since the last speed-up or throttle. */
  calmRequests: number;
}

export const INITIAL_PACE: AdaptivePace = { factor: 1, calmRequests: 0 };

/** At most twice as fast as configured, at most four times as slow. */
export const PACE_FACTOR_MIN = 0.5;
export const PACE_FACTOR_MAX = 4;
/** About 2.5 minutes at the default pace: long enough that a speed-up isn't a fluke. */
export const SPEED_UP_AFTER = 100;
const SPEED_UP_STEP = 0.9;
/**
 * However fast the factor gets, the wait never drops below this. It's under the settings' 1 s
 * floor on purpose: only a long calm stretch earns it, and one throttle doubles the wait again.
 */
export const PACE_FLOOR_MS = 500;

/** A random gap between two requests, within the configured pace scaled by `factor`. */
export function paceDelayMs(
  { paceMinMs, paceMaxMs }: Pace,
  random: () => number,
  factor = 1,
): number {
  return Math.max(PACE_FLOOR_MS, (paceMinMs + random() * (paceMaxMs - paceMinMs)) * factor);
}

/** How long to wait before the next request, given when the last one was sent. */
export function paceWaitMs(
  lastRequestAt: number | null,
  pace: Pace,
  factor: number,
  random: () => number,
  now: number,
): number {
  if (lastRequestAt === null) return 0;
  return Math.max(0, lastRequestAt + paceDelayMs(pace, random, factor) - now);
}

/** One more request sent; every SPEED_UP_AFTER of them without a throttle speeds up by 10 %. */
export function paceAfterRequest({ factor, calmRequests }: AdaptivePace): AdaptivePace {
  const calm = calmRequests + 1;
  if (calm < SPEED_UP_AFTER) return { factor, calmRequests: calm };
  return { factor: Math.max(PACE_FACTOR_MIN, factor * SPEED_UP_STEP), calmRequests: 0 };
}

/** Bandcamp pushed back: wait twice as long between requests from now on. */
export function paceAfterThrottle({ factor }: AdaptivePace): AdaptivePace {
  return { factor: Math.min(PACE_FACTOR_MAX, factor * 2), calmRequests: 0 };
}
