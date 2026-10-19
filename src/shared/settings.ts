// User-adjustable settings. Stored in chrome.storage.local; everything else lives in IndexedDB.

export interface Settings {
  /** Random delay between scanner requests, in ms. */
  paceMinMs: number;
  paceMaxMs: number;
  dailyRequestBudget: number;
  /** Max collection items fetched per fan (newest first). */
  collectionCap: number;
  collectionBatchSize: number;
  /** Max supporters paged per release (most recent first). */
  supportersPerReleaseCap: number;
  /** Fans outside this collection-size range are ignored by twins scoring. */
  minCollectionSize: number;
  maxCollectionSize: number;
  topTwinsK: number;
  labelClusterDownweight: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  paceMinMs: 1500,
  paceMaxMs: 3000,
  dailyRequestBudget: 3000,
  collectionCap: 2000,
  collectionBatchSize: 100,
  supportersPerReleaseCap: 500,
  minCollectionSize: 10,
  maxCollectionSize: 20000,
  topTwinsK: 30,
  labelClusterDownweight: true,
};

const STORAGE_KEY = 'settings';

export async function loadSettings(): Promise<Settings> {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  return { ...DEFAULT_SETTINGS, ...(stored[STORAGE_KEY] as Partial<Settings> | undefined) };
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = { ...(await loadSettings()), ...patch };
  await chrome.storage.local.set({ [STORAGE_KEY]: next });
  return next;
}
