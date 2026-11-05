// When to call a parser broken. One odd page (a fan with a strange header) is skipped and
// logged, not shown: only a run of failures of one kind means Bandcamp changed something.

import type { JobKind } from '../../db';

/** Which parser broke: a job's own, or the profile page that only ranks fans (decisions §12). */
export type ParserKind = JobKind | 'profile';

/** Failures in a row of one kind, with the latest message. */
export interface ParserFailure {
  streak: number;
  message: string;
}

export type ParserFailures = Partial<Record<ParserKind, ParserFailure>>;

export const PARSER_BROKEN_AFTER = 3;

export function withParserFailure(
  failures: ParserFailures,
  kind: ParserKind,
  message: string,
): ParserFailures {
  return { ...failures, [kind]: { streak: (failures[kind]?.streak ?? 0) + 1, message } };
}

/** The same object when nothing changes, so callers can skip a save. */
export function withParserSuccess(failures: ParserFailures, kind: ParserKind): ParserFailures {
  if (!(kind in failures)) return failures;
  const { [kind]: _cleared, ...rest } = failures;
  return rest;
}

/** The latest message of a parser that has failed often enough in a row to call broken. */
export function brokenParser(failures: ParserFailures): string | null {
  const broken = Object.values(failures).find((failure) => failure.streak >= PARSER_BROKEN_AFTER);
  return broken?.message ?? null;
}
