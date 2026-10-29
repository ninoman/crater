// How many fans were read when crate mates were last computed. It's kept in chrome.storage.local
// because MV3 workers die when idle, and an in-memory "fans since" counter rarely reached the
// trigger during slow scanning, so the leaderboard went stale (decisions §7).

export interface CrateMatesBasisStore {
  /** Null before the first recompute this storage has seen. */
  load(): Promise<number | null>;
  save(fansRead: number): Promise<void>;
}

const STORAGE_KEY = 'crateMatesFansRead';

export const chromeCrateMatesBasisStore: CrateMatesBasisStore = {
  async load() {
    const stored = (await chrome.storage.local.get(STORAGE_KEY))[STORAGE_KEY];
    return typeof stored === 'number' ? stored : null;
  },
  async save(fansRead) {
    await chrome.storage.local.set({ [STORAGE_KEY]: fansRead });
  },
};

/** True when enough fans were read since the last recompute to run another. */
export function recomputeDue(fansRead: number, atLastRecompute: number | null, every: number) {
  return atLastRecompute === null || fansRead - atLastRecompute >= every;
}
