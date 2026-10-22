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
  /** Lately twins: a purchase counts half as much after this many months (decisions §11). */
  latelyHalfLifeMonths: number;
  /** Fans who bought less than this lately (purchases weighed by age) get no lately score. */
  latelyMinPurchases: number;
  /** How many of the top lately twins get their newest purchases re-read more often. 0 turns it off. */
  latelyRescanTwins: number;
  /** Days between those re-reads (decisions §11). Everyone else waits the usual 30. */
  latelyRescanDays: number;
  /** Queue your own releases' supporters after each sync of your collection (decisions §5). */
  seedFromCollection: boolean;
  /** "owned" / "wishlist" / "3 twins" next to release links on Bandcamp pages (decisions §15). */
  pageBadges: boolean;
  /** Releases from artists and labels you follow score a little higher (decisions §16). */
  followingBoost: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  paceMinMs: 1500,
  paceMaxMs: 3000,
  dailyRequestBudget: 10_000,
  collectionCap: 2000,
  collectionBatchSize: 100,
  supportersPerReleaseCap: 500,
  minCollectionSize: 10,
  maxCollectionSize: 20000,
  topTwinsK: 30,
  labelClusterDownweight: true,
  latelyHalfLifeMonths: 6,
  latelyMinPurchases: 5,
  latelyRescanTwins: 25,
  latelyRescanDays: 7,
  seedFromCollection: true,
  pageBadges: false,
  followingBoost: true,
};

export type NumericSetting = {
  [K in keyof Settings]: Settings[K] extends number ? K : never;
}[keyof Settings];

export type BooleanSetting = {
  [K in keyof Settings]: Settings[K] extends boolean ? K : never;
}[keyof Settings];

/**
 * Allowed range of each number. The pace floor keeps the scanner polite whatever is typed, and
 * the batch ceiling is the largest page Bandcamp was seen to serve (decisions §1).
 */
export const SETTING_LIMITS: Record<NumericSetting, { min: number; max: number }> = {
  paceMinMs: { min: 1000, max: 60_000 },
  paceMaxMs: { min: 1000, max: 120_000 },
  dailyRequestBudget: { min: 0, max: 20_000 },
  collectionCap: { min: 100, max: 10_000 },
  collectionBatchSize: { min: 20, max: 500 },
  supportersPerReleaseCap: { min: 80, max: 5000 },
  minCollectionSize: { min: 1, max: 1000 },
  maxCollectionSize: { min: 100, max: 1_000_000 },
  topTwinsK: { min: 5, max: 200 },
  latelyHalfLifeMonths: { min: 1, max: 36 },
  latelyMinPurchases: { min: 1, max: 100 },
  latelyRescanTwins: { min: 0, max: 200 },
  latelyRescanDays: { min: 1, max: 30 },
};

export type SettingsErrors = Partial<Record<keyof Settings, string>>;

/** Checks a whole settings object. Empty when it's fine to save. */
export function validateSettings(settings: Settings): SettingsErrors {
  const errors: SettingsErrors = {};
  for (const [key, { min, max }] of Object.entries(SETTING_LIMITS) as [
    NumericSetting,
    { min: number; max: number },
  ][]) {
    const value = settings[key];
    if (!Number.isInteger(value)) errors[key] = 'Enter a whole number';
    else if (value < min || value > max) errors[key] = `Between ${min} and ${max}`;
  }
  if (!errors.paceMaxMs && settings.paceMaxMs < settings.paceMinMs) {
    errors.paceMaxMs = 'At least the minimum pace';
  }
  if (!errors.maxCollectionSize && settings.maxCollectionSize < settings.minCollectionSize) {
    errors.maxCollectionSize = 'At least the minimum size';
  }
  return errors;
}

/** Stored values that are missing, of the wrong type or out of range fall back to the default. */
export function sanitizeSettings(stored: unknown): Settings {
  const raw =
    typeof stored === 'object' && stored !== null ? (stored as Record<string, unknown>) : {};
  const merged = { ...DEFAULT_SETTINGS };
  for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]) {
    const value = raw[key];
    if (typeof value === typeof DEFAULT_SETTINGS[key]) Object.assign(merged, { [key]: value });
  }
  const errors = validateSettings(merged);
  for (const key of Object.keys(errors) as (keyof Settings)[]) {
    Object.assign(merged, { [key]: DEFAULT_SETTINGS[key] });
  }
  // Resetting one side of a pair can leave it out of order with the other, kept side.
  return Object.keys(validateSettings(merged)).length === 0 ? merged : { ...DEFAULT_SETTINGS };
}

const STORAGE_KEY = 'settings';

export async function loadSettings(): Promise<Settings> {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  return sanitizeSettings(stored[STORAGE_KEY]);
}

/** Saves a full, valid settings object. Throws if it isn't valid, so callers validate first. */
export async function saveSettings(settings: Settings): Promise<Settings> {
  const errors = validateSettings(settings);
  if (Object.keys(errors).length > 0) {
    throw new Error(`Invalid settings: ${Object.keys(errors).join(', ')}`);
  }
  await chrome.storage.local.set({ [STORAGE_KEY]: settings });
  return settings;
}

export async function resetSettings(): Promise<Settings> {
  await chrome.storage.local.remove(STORAGE_KEY);
  return { ...DEFAULT_SETTINGS };
}
