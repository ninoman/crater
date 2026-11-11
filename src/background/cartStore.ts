// Your Bandcamp cart as last seen, so lists can leave out what's in it. Session storage: it
// outlives a killed worker, and a cart that old is worth re-reading anyway.

import type { Cart, ItemKey } from '../bandcamp';

const STORAGE_KEY = 'cart';

export async function loadCart(): Promise<Cart | null> {
  const stored = await chrome.storage.session.get(STORAGE_KEY);
  return (stored[STORAGE_KEY] as Cart | undefined) ?? null;
}

export async function saveCart(cart: Cart): Promise<void> {
  await chrome.storage.session.set({ [STORAGE_KEY]: cart });
}

/** The albums and tracks in your cart; empty before any page has shown it. */
export async function cartKeys(): Promise<ReadonlySet<ItemKey>> {
  return new Set((await loadCart())?.items.map((item) => item.itemKey));
}
