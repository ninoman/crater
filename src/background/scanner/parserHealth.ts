// When to call a parser broken. One odd page (a fan with a strange header) is skipped and
// logged, not shown: only a run of failures of one kind means Bandcamp changed something.

import type { JobKind, JobSpec } from '../../db';

/** Which parser broke: a job's own, or the profile page that only ranks fans (decisions §12). */
export type ParserKind = JobKind | 'profile';

/** The job that failed last, and where it waited, so "Try again" can queue it once more. */
export interface RetryJob {
  spec: JobSpec;
  priority: number;
}

/** Failures in a row of one kind, with the latest message. */
export interface ParserFailure {
  streak: number;
  message: string;
  /** Missing on failures stored before "Try again" existed. */
  retry?: RetryJob;
}

export type ParserFailures = Partial<Record<ParserKind, ParserFailure>>;

export const PARSER_BROKEN_AFTER = 3;

export function withParserFailure(
  failures: ParserFailures,
  kind: ParserKind,
  message: string,
  retry: RetryJob,
): ParserFailures {
  return { ...failures, [kind]: { streak: (failures[kind]?.streak ?? 0) + 1, message, retry } };
}

/** The same object when nothing changes, so callers can skip a save. */
export function withParserSuccess(failures: ParserFailures, kind: ParserKind): ParserFailures {
  if (!(kind in failures)) return failures;
  const { [kind]: _cleared, ...rest } = failures;
  return rest;
}

export interface BrokenParser {
  kind: ParserKind;
  failure: ParserFailure;
}

/** A parser that has failed often enough in a row to call broken. */
export function brokenParser(failures: ParserFailures): BrokenParser | null {
  for (const [kind, failure] of Object.entries(failures) as [ParserKind, ParserFailure][]) {
    if (failure.streak >= PARSER_BROKEN_AFTER) return { kind, failure };
  }
  return null;
}
