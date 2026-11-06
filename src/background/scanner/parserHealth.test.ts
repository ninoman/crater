import { describe, expect, it } from 'vitest';
import {
  brokenParser,
  PARSER_BROKEN_AFTER,
  withParserFailure,
  withParserSuccess,
  type ParserFailures,
  type RetryJob,
} from './parserHealth';

function fanRetry(fanId: number): RetryJob {
  return { spec: { kind: 'fan', target: `${fanId}`, via: null }, priority: 3.25 };
}

function failTimes(times: number, failures: ParserFailures = {}): ParserFailures {
  let next = failures;
  for (let i = 1; i <= times; i++) {
    next = withParserFailure(next, 'profile', `fan ${i}: bad`, fanRetry(i));
  }
  return next;
}

describe('parser health', () => {
  it('is not broken by one odd page', () => {
    expect(brokenParser(failTimes(1))).toBeNull();
  });

  it('is broken after a run of failures of one kind, with the latest message and job', () => {
    expect(brokenParser(failTimes(PARSER_BROKEN_AFTER))).toEqual({
      kind: 'profile',
      failure: {
        streak: PARSER_BROKEN_AFTER,
        message: `fan ${PARSER_BROKEN_AFTER}: bad`,
        retry: fanRetry(PARSER_BROKEN_AFTER),
      },
    });
  });

  it('keeps kinds apart, so failures of different kinds never add up', () => {
    const mixed = withParserFailure(
      withParserFailure(
        withParserFailure({}, 'fan', 'a', fanRetry(1)),
        'profile',
        'b',
        fanRetry(2),
      ),
      'release',
      'c',
      {
        spec: { kind: 'release', target: 'a1', url: 'https://x.bandcamp.com/album/y' },
        priority: 1,
      },
    );
    expect(brokenParser(mixed)).toBeNull();
  });

  it('ends a run when that kind parses, and only that kind', () => {
    const failures = withParserFailure(failTimes(PARSER_BROKEN_AFTER), 'fan', 'x', fanRetry(9));
    expect(withParserSuccess(failures, 'profile')).toEqual({
      fan: { streak: 1, message: 'x', retry: fanRetry(9) },
    });
  });

  it('returns the same object when a success changes nothing', () => {
    const failures = failTimes(1);
    expect(withParserSuccess(failures, 'fan')).toBe(failures);
  });
});
