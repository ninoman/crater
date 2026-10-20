// The scanner's own state: back-off, budget, pace and lock. Kept in chrome.storage.local
// so a pause survives the worker being killed and the browser restarting.

import type { JobKind } from '../../db';
import type { ScannerPause } from '../../shared/scan';
import type { Backoff } from './backoff';
import { budgetExhausted, nextLocalMidnight, type Budget } from './budget';
import type { Lock } from './lock';

export interface ScannerState {
  backoff: Backoff | null;
  budget: Budget | null;
  lastRequestAt: number | null;
  lock: Lock | null;
  lastError: string | null;
  /**
   * The last ParserError, meaning Bandcamp changed something we read. Cleared once a job of
   * the same kind succeeds, so one odd page doesn't look like a broken parser for good.
   */
  parserError: { kind: JobKind; message: string } | null;
  /** Paused from the popup. Stays paused until resumed there. */
  paused: boolean;
}

export const INITIAL_SCANNER_STATE: ScannerState = {
  backoff: null,
  budget: null,
  lastRequestAt: null,
  lock: null,
  lastError: null,
  parserError: null,
  paused: false,
};

export interface ScannerStore {
  load(): Promise<ScannerState>;
  /** Merges `patch` into the stored state and returns the result. */
  save(patch: Partial<ScannerState>): Promise<ScannerState>;
}

const STORAGE_KEY = 'scanner';

export const chromeScannerStore: ScannerStore = {
  async load() {
    const stored = await chrome.storage.local.get(STORAGE_KEY);
    return {
      ...INITIAL_SCANNER_STATE,
      ...(stored[STORAGE_KEY] as Partial<ScannerState> | undefined),
    };
  },
  async save(patch) {
    const next = { ...(await this.load()), ...patch };
    await chrome.storage.local.set({ [STORAGE_KEY]: next });
    return next;
  },
};

/** Your own pause comes first. Back-off wins over the budget, since it's Bandcamp asking. */
export function pauseFor(
  state: ScannerState,
  dailyBudget: number,
  now: number,
): ScannerPause | null {
  if (state.paused) return { reason: 'manual' };
  if (state.backoff && state.backoff.until > now) {
    return { reason: 'backoff', until: state.backoff.until };
  }
  if (budgetExhausted(state.budget, dailyBudget, now)) {
    return { reason: 'budget', until: nextLocalMidnight(now) };
  }
  return null;
}
