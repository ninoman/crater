import { BandcampApiError, ParserError } from '../../bandcamp';
import { BlockedHostError, HttpError, NetworkError } from '../http';
import { parseRetryAfter } from './backoff';

/** What a failed job run means for the queue. */
export type Failure =
  /** Bandcamp is pushing back: pause everything, keep the job as it is. */
  | { kind: 'throttled'; retryAfterMs: number | null }
  /** No answer at all. One is a blip; a run of them means we're offline (scheduler). */
  | { kind: 'network' }
  /** Retrying won't help (changed markup, a 4xx, an API error, a custom domain): drop the job. */
  | { kind: 'permanent' }
  /** Probably ours, e.g. a database error: retry this job a few times. */
  | { kind: 'transient' };

export function classifyFailure(error: unknown, now: number): Failure {
  if (error instanceof HttpError) {
    if (error.status === 429 || error.status >= 500) {
      return {
        kind: 'throttled',
        retryAfterMs: parseRetryAfter(error.retryAfter, now),
      };
    }
    return { kind: 'permanent' };
  }
  if (error instanceof NetworkError) return { kind: 'network' };
  if (error instanceof BlockedHostError) return { kind: 'permanent' };
  if (error instanceof ParserError || error instanceof BandcampApiError) {
    return { kind: 'permanent' };
  }
  return { kind: 'transient' };
}
