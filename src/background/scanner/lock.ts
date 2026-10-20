// The scan loop's lock, kept in chrome.storage so it outlives one worker instance.

export interface Lock {
  owner: string;
  heartbeatAt: number;
}

/** Longer than one loop turn (a 3 s pace plus a 30 s request timeout), so a live owner keeps it. */
export const LOCK_TTL_MS = 45_000;

/** Free, already ours, or left behind by a worker that died without releasing it. */
export function canTakeLock(lock: Lock | null, owner: string, now: number): boolean {
  return lock === null || lock.owner === owner || now - lock.heartbeatAt > LOCK_TTL_MS;
}
