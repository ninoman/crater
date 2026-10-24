import { useMemo, useRef } from 'react';
import { type ListedItem, type ListSource, sameListedItem } from '../shared/itemList';
import { sendMessage } from '../shared/messages';
import { reuseUnchanged } from './reuseUnchanged';
import { type QueryView, useFollowingQuery } from './useFollowingQuery';

export type ListItemsView = QueryView<readonly ListedItem[]>;

const byKey = (item: ListedItem) => item.itemKey;

/**
 * Your wishlist or collection with your tags, newest first. Refetches after any tag
 * change. Items that didn't change keep their object, so a refetch re-renders only the
 * cards that did.
 */
export function useListItems(source: ListSource): ListItemsView {
  const view = useFollowingQuery(`list:${source}`, () => sendMessage('listItems', { source }));
  const last = useRef<readonly ListedItem[]>([]);
  return useMemo(() => {
    if (view.state !== 'ready') return view;
    last.current = reuseUnchanged(last.current, view.data, byKey, sameListedItem);
    return { state: 'ready', data: last.current };
  }, [view]);
}
