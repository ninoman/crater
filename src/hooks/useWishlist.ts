import { sendMessage } from '../shared/messages';
import type { WishlistItem } from '../shared/wishlist';
import { type QueryView, useFollowingQuery } from './useFollowingQuery';

export type WishlistView = QueryView<WishlistItem[]>;

/** Your wishlist with your tags, newest first. Refetches after any tag change. */
export function useWishlist(): WishlistView {
  return useFollowingQuery('wishlist', () => sendMessage('listWishlist', {}));
}
