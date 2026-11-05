// The last scanner errors, kept in chrome.storage.local so a report can include them after
// the worker has been killed and restarted.

import type { ErrorLogEntry } from '../shared/diagnostics';

const STORAGE_KEY = 'errorLog';
export const ERROR_LOG_SIZE = 50;

/** Newest first, capped. */
export function prependEntry(log: readonly ErrorLogEntry[], entry: ErrorLogEntry): ErrorLogEntry[] {
  return [entry, ...log].slice(0, ERROR_LOG_SIZE);
}

export async function loadErrorLog(): Promise<ErrorLogEntry[]> {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  return (stored[STORAGE_KEY] as ErrorLogEntry[] | undefined) ?? [];
}

/** Best effort: a log that can't be written must never stop the scanner. */
export async function logError(entry: ErrorLogEntry): Promise<void> {
  try {
    await chrome.storage.local.set({ [STORAGE_KEY]: prependEntry(await loadErrorLog(), entry) });
  } catch (error) {
    console.warn('crater: could not write the error log', error);
  }
}
