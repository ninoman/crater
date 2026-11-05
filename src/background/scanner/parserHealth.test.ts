import { describe, expect, it } from 'vitest';
import {
  brokenParser,
  PARSER_BROKEN_AFTER,
  withParserFailure,
  withParserSuccess,
  type ParserFailures,
} from './parserHealth';

function failTimes(times: number, failures: ParserFailures = {}): ParserFailures {
  let next = failures;
  for (let i = 1; i <= times; i++) next = withParserFailure(next, 'profile', `fan ${i}: bad`);
  return next;
}

describe('parser health', () => {
  it('is not broken by one odd page', () => {
    expect(brokenParser(failTimes(1))).toBeNull();
  });

  it('is broken after a run of failures of one kind, with the latest message', () => {
    expect(brokenParser(failTimes(PARSER_BROKEN_AFTER))).toBe(`fan ${PARSER_BROKEN_AFTER}: bad`);
  });

  it('keeps kinds apart, so failures of different kinds never add up', () => {
    const mixed = withParserFailure(
      withParserFailure(withParserFailure({}, 'fan', 'a'), 'profile', 'b'),
      'release',
      'c',
    );
    expect(brokenParser(mixed)).toBeNull();
  });

  it('ends a run when that kind parses, and only that kind', () => {
    const failures = withParserFailure(failTimes(PARSER_BROKEN_AFTER), 'fan', 'x');
    expect(withParserSuccess(failures, 'profile')).toEqual({ fan: { streak: 1, message: 'x' } });
  });

  it('returns the same object when a success changes nothing', () => {
    const failures = failTimes(1);
    expect(withParserSuccess(failures, 'fan')).toBe(failures);
  });
});
