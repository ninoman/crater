import { useMemo, useRef } from 'react';
import { sendMessage } from '../shared/messages';
import { sameWishlistItem, type WishlistItem } from '../shared/wishlist';
import { reuseUnchanged } from './reuseUnchanged';
import { type QueryView, useFollowingQuery } from './useFollowingQuery';

export type WishlistView = QueryView<readonly WishlistItem[]>;

const byKey = (item: WishlistItem) => item.itemKey;

/**
 * Your wishlist with your tags, newest first. Refetches after any tag change. Items that didn't
 * change keep their object, so a refetch re-renders only the cards that did.
 */
export function useWishlist(): WishlistView {
  const view = useFollowingQuery('wishlist', () => sendMessage('listWishlist', {}));
  const last = useRef<readonly WishlistItem[]>([]);
  return useMemo(() => {
    if (view.state !== 'ready') return view;
    last.current = reuseUnchanged(last.current, view.data, byKey, sameWishlistItem);
    return { state: 'ready', data: last.current };
  }, [view]);
}
