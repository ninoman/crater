// Back-off math. Two kinds: a global pause when Bandcamp pushes back, and per-job retries for
// errors that are probably ours.

export const BACKOFF_BASE_MS = 60_000;
export const BACKOFF_MAX_MS = 60 * 60_000;

/** This many requests in a row with no answer means we're offline, so the whole queue pauses. */
export const OFFLINE_AFTER_FAILURES = 5;

/** A failed job is retried this many times before it's dropped. */
export const MAX_JOB_ATTEMPTS = 3;

/** The whole queue is paused until `until`. `failures` counts consecutive throttled requests. */
export interface Backoff {
  until: number;
  failures: number;
}

/** Retry-After is either a number of seconds or an HTTP date. Returns a delay in ms. */
export function parseRetryAfter(value: string | null, now: number): number | null {
  if (value === null) return null;
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) return Number(trimmed) * 1000;
  const at = Date.parse(trimmed);
  return Number.isNaN(at) ? null : Math.max(0, at - now);
}

/** The server's Retry-After if it sent one, else 60 s, 2 min, 4 min, … up to an hour. */
export function backoffDelayMs(failures: number, retryAfterMs: number | null): number {
  if (retryAfterMs !== null) return retryAfterMs;
  return Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** Math.max(0, failures - 1));
}

export function nextBackoff(
  previous: Backoff | null,
  retryAfterMs: number | null,
  now: number,
): Backoff {
  const failures = (previous?.failures ?? 0) + 1;
  return { failures, until: now + backoffDelayMs(failures, retryAfterMs) };
}

/** When a job that failed `attempts` times before should run again, or null to drop it. */
export function jobRetryAt(attempts: number, now: number): number | null {
  if (attempts + 1 >= MAX_JOB_ATTEMPTS) return null;
  return now + BACKOFF_BASE_MS * 2 ** attempts;
}
