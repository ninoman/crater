import type { ItemKey } from '../bandcamp';
import { sendMessage } from '../shared/messages';
import { type QueryView, useFollowingQuery } from './useFollowingQuery';

/** Tag ids on a release, or null when it isn't in your wishlist. */
export type ItemTagsView = QueryView<number[] | null>;

/** The tags on one wishlisted release, for the chips on its own page. */
export function useItemTags(itemKey: ItemKey): ItemTagsView {
  return useFollowingQuery(`item:${itemKey}`, () => sendMessage('getItemTags', { itemKey }));
}
