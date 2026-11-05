// What "Copy diagnostics" hands over: enough to see why scanning went wrong on someone else's
// machine. Public Bandcamp URLs and Crater's own state only, never cookies or tokens.

import type { ScannerStatus } from './scan';

/** What the scanner did about a failed request. */
export type ErrorOutcome = 'paused' | 'offline' | 'retrying' | 'dropped' | 'skipped';

export interface ErrorLogEntry {
  at: number;
  /** The error's class, e.g. ParserError or HttpError. */
  name: string;
  /** `<job kind> <target>: <error message>`. */
  message: string;
  outcome: ErrorOutcome;
}

export interface Diagnostics {
  version: string;
  browser: string;
  createdAt: string;
  scanner: ScannerStatus;
  /** Newest first. */
  errors: ErrorLogEntry[];
}

/** Readable times, so a pasted report needs no decoding. */
export function formatDiagnostics(diagnostics: Diagnostics): string {
  const errors = diagnostics.errors.map(({ at, ...entry }) => ({
    at: new Date(at).toISOString(),
    ...entry,
  }));
  return JSON.stringify({ ...diagnostics, errors }, null, 2);
}
