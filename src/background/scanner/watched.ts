// Releases open in a tab, so progress is only computed for pages someone is looking at.
// Session storage outlives a killed worker but not the browser, like the tabs themselves.

import type { ItemKey } from '../../bandcamp';

const STORAGE_KEY = 'watchedReleases';
const MAX_WATCHED = 20;

export async function watchedReleases(): Promise<ItemKey[]> {
  const stored = await chrome.storage.session.get(STORAGE_KEY);
  return (stored[STORAGE_KEY] as ItemKey[] | undefined) ?? [];
}

export async function watchRelease(itemKey: ItemKey): Promise<void> {
  const current = await watchedReleases();
  const next = [itemKey, ...current.filter((key) => key !== itemKey)].slice(0, MAX_WATCHED);
  await chrome.storage.session.set({ [STORAGE_KEY]: next });
}
