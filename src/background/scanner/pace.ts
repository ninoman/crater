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
 * Getting back to the configured pace after a throttle is quicker: that pace is one the user
 * chose, not a guess at Bandcamp's limit. From the slowest factor it takes 140 requests, about
 * 8 minutes at the default pace, where the 100-request rule took over an hour (decisions §5).
 */
export const RECOVER_AFTER = 20;
const RECOVER_STEP = 0.8;
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

/**
 * One more request sent. Slower than configured, every RECOVER_AFTER calm requests speed up by
 * 20 %, stopping at the configured pace; from there, every SPEED_UP_AFTER speed up by 10 %.
 */
export function paceAfterRequest({ factor, calmRequests }: AdaptivePace): AdaptivePace {
  const calm = calmRequests + 1;
  const recovering = factor > 1;
  if (calm < (recovering ? RECOVER_AFTER : SPEED_UP_AFTER)) return { factor, calmRequests: calm };
  const next = recovering
    ? Math.max(1, factor * RECOVER_STEP)
    : Math.max(PACE_FACTOR_MIN, factor * SPEED_UP_STEP);
  return { factor: next, calmRequests: 0 };
}

/** Bandcamp pushed back: wait twice as long between requests from now on. */
export function paceAfterThrottle({ factor }: AdaptivePace): AdaptivePace {
  return { factor: Math.min(PACE_FACTOR_MAX, factor * 2), calmRequests: 0 };
}
