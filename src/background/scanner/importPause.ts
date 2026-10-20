// Keeps the scanner still while a database import replaces every table.

import { canTakeLock } from './lock';
import type { ScannerStore } from './state';

const POLL_MS = 250;
/** Longer than the lock's TTL, so even a lock left by a dead worker is given up by then. */
const WAIT_LIMIT_MS = 60_000;

export interface ImportPauseDeps {
  store: ScannerStore;
  now: () => number;
  sleep: (ms: number) => Promise<void>;
  /** Your own collection sync writes to the same tables. */
  ownSyncSettled: () => Promise<void>;
  /** Called after the pause lifts, to wake the scan loop. */
  resume: () => void;
}

/**
 * Pauses the scanner under its own flag (your pause stays as it was), waits for the request in
 * flight to finish, runs `work`, then lifts the pause however `work` ended.
 */
export async function withImportPause<T>(
  deps: ImportPauseDeps,
  work: () => Promise<T>,
): Promise<T> {
  const { store, now, sleep } = deps;
  await store.save({ importing: true });
  try {
    const giveUpAt = now() + WAIT_LIMIT_MS;
    while (!canTakeLock((await store.load()).lock, 'import', now()) && now() < giveUpAt) {
      await sleep(POLL_MS);
    }
    await deps.ownSyncSettled();
    return await work();
  } finally {
    await store.save({ importing: false });
    deps.resume();
  }
}
