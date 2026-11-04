// Which release each tab shows, so closing the last tab on a release takes it off the queue.
// Session storage outlives a killed worker but not the browser, like the tabs themselves.

import type { ItemKey } from '../../bandcamp';

const STORAGE_KEY = 'releaseTabs';

/** Tab id → the release it shows. */
export type ReleaseTabs = Record<string, ItemKey>;

/**
 * Takes a tab out of the map. `left` is the release it showed when no other tab still shows it,
 * else null.
 */
export function leaveTab(
  tabs: ReleaseTabs,
  tabId: number,
): { tabs: ReleaseTabs; left: ItemKey | null } {
  const { [tabId]: shown, ...rest } = tabs;
  const stillOpen = Object.values(rest).includes(shown as ItemKey);
  return { tabs: rest, left: shown === undefined || stillOpen ? null : shown };
}

async function load(): Promise<ReleaseTabs> {
  const stored = await chrome.storage.session.get(STORAGE_KEY);
  return (stored[STORAGE_KEY] as ReleaseTabs | undefined) ?? {};
}

function save(tabs: ReleaseTabs): Promise<void> {
  return chrome.storage.session.set({ [STORAGE_KEY]: tabs });
}

/** A tab now shows `release`. Returns the release it moved away from, if no other tab shows it. */
export async function showReleaseInTab(tabId: number, release: ItemKey): Promise<ItemKey | null> {
  const { tabs, left } = leaveTab(await load(), tabId);
  await save({ ...tabs, [tabId]: release });
  return left === release ? null : left;
}

/** A tab closed. Returns the release it showed, if no other tab shows it. */
export async function closeTab(tabId: number): Promise<ItemKey | null> {
  const { tabs, left } = leaveTab(await load(), tabId);
  await save(tabs);
  return left;
}

export async function releasesInTabs(): Promise<ItemKey[]> {
  return [...new Set(Object.values(await load()))];
}
