import { describe, expect, it } from 'vitest';
import type { ErrorLogEntry } from '../shared/diagnostics';
import { ERROR_LOG_SIZE, prependEntry } from './errorLog';

const entry = (at: number): ErrorLogEntry => ({
  at,
  name: 'ParserError',
  message: `fan ${at}: bad`,
  outcome: 'dropped',
});

describe('prependEntry', () => {
  it('keeps the newest first and drops the oldest past the cap', () => {
    let log: ErrorLogEntry[] = [];
    for (let at = 1; at <= ERROR_LOG_SIZE + 2; at++) log = prependEntry(log, entry(at));
    expect(log).toHaveLength(ERROR_LOG_SIZE);
    expect(log[0]?.at).toBe(ERROR_LOG_SIZE + 2);
    expect(log.at(-1)?.at).toBe(3);
  });
});
