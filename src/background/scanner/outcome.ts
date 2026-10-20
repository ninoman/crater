import { BandcampApiError, ParserError } from '../../bandcamp';
import { HttpError, NetworkError } from '../http';
import { parseRetryAfter } from './backoff';

/** What a failed job run means for the queue. */
export type Failure =
  /** Bandcamp is pushing back, or we're offline: pause everything, keep the job as it is. */
  | { kind: 'throttled'; retryAfterMs: number | null }
  /** Retrying won't help (changed markup, a 4xx, an API error): drop the job. */
  | { kind: 'permanent' }
  /** Probably ours, e.g. a database error: retry this job a few times. */
  | { kind: 'transient' };

export function classifyFailure(error: unknown, now: number): Failure {
  if (error instanceof HttpError) {
    if (error.status === 429 || error.status >= 500) {
      return { kind: 'throttled', retryAfterMs: parseRetryAfter(error.retryAfter, now) };
    }
    return { kind: 'permanent' };
  }
  if (error instanceof NetworkError) return { kind: 'throttled', retryAfterMs: null };
  if (error instanceof ParserError || error instanceof BandcampApiError) {
    return { kind: 'permanent' };
  }
  return { kind: 'transient' };
}
