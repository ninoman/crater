// When you last opened New from your follows and when we last notified you, in
// chrome.storage.local (decisions §22). Not in IndexedDB: clearing the data or importing a backup
// shouldn't make everything look new again.

export interface FollowsState {
  /** The latest opening of the tab. */
  lastVisitAt: number | null;
  /** The latest notification, so a release is announced once. */
  lastNotifiedAt: number | null;
}

export interface FollowsStore {
  load(): Promise<FollowsState>;
  save(patch: Partial<FollowsState>): Promise<FollowsState>;
}

const STORAGE_KEY = 'followsDigest';
const INITIAL: FollowsState = { lastVisitAt: null, lastNotifiedAt: null };

export const chromeFollowsStore: FollowsStore = {
  async load() {
    const stored = await chrome.storage.local.get(STORAGE_KEY);
    return { ...INITIAL, ...(stored[STORAGE_KEY] as Partial<FollowsState> | undefined) };
  },
  async save(patch) {
    const next = { ...(await this.load()), ...patch };
    await chrome.storage.local.set({ [STORAGE_KEY]: next });
    return next;
  },
};
