import type { ItemKey } from '../bandcamp';
import type { ListedItem } from './itemList';

/**
 * `items` in the order of `keys`, for a reorder not saved yet. Items `keys` doesn't name, which
 * arrived since, go first, where Bandcamp puts new purchases.
 */
export function applyOrder(
  items: readonly ListedItem[],
  keys: readonly ItemKey[],
): readonly ListedItem[] {
  const rank = new Map(keys.map((key, i) => [key, i]));
  const at = (item: ListedItem) => rank.get(item.itemKey) ?? -1;
  return [...items].sort((a, b) => at(a) - at(b));
}
