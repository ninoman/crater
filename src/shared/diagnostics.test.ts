import { describe, expect, it } from 'vitest';
import { type Diagnostics, formatDiagnostics } from './diagnostics';

describe('formatDiagnostics', () => {
  it('writes error times as ISO dates', () => {
    const diagnostics = {
      version: '0.13.0',
      browser: 'test',
      createdAt: '2026-11-04T00:00:00.000Z',
      scanner: {} as Diagnostics['scanner'],
      errors: [{ at: 0, name: 'ParserError', message: 'fan 7: bad', outcome: 'dropped' }],
    } satisfies Diagnostics;
    const parsed = JSON.parse(formatDiagnostics(diagnostics)) as { errors: { at: string }[] };
    expect(parsed.errors[0]?.at).toBe('1970-01-01T00:00:00.000Z');
  });
});
