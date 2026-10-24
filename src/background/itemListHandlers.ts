// Message handlers for your wishlist and the tags on its items. The rules live in the repos.

import { artUrl } from '../bandcamp';
import {
  assignItemTag,
  getItemTags,
  getMe,
  listWishlist,
  markUnwishlisted,
  markWishlisted,
  type DigheadDb,
} from '../db';
import type { MessageHandlers } from '../shared/messages';

export type WishlistHandlers = Pick<
  MessageHandlers,
  'listWishlist' | 'getItemTags' | 'assignItemTag' | 'markWishlisted' | 'markUnwishlisted'
>;

export function wishlistHandlers(db: DigheadDb): WishlistHandlers {
  return {
    // Before your first sync there's no `me`, so no wishlist yet.
    listWishlist: async () => {
      const me = await getMe(db);
      if (!me) return [];
      return (await listWishlist(db, me.fanId)).map(({ item, addedAt, tagIds }) => ({
        itemKey: item.itemKey,
        title: item.title,
        artist: item.artist,
        url: item.url,
        coverUrl: item.artId === null ? null : artUrl(item.artId),
        addedAt,
        tagIds,
      }));
    },
    getItemTags: async ({ itemKey }) => {
      const me = await getMe(db);
      return me ? getItemTags(db, me.fanId, itemKey) : null;
    },
    assignItemTag: ({ tagId, itemKeys, action }) => assignItemTag(db, tagId, itemKeys, action),
    markWishlisted: async ({ release }) => {
      const me = await getMe(db);
      if (!me) return false;
      await markWishlisted(db, me.fanId, release, Date.now());
      return true;
    },
    markUnwishlisted: async ({ itemKey }) => {
      const me = await getMe(db);
      if (me) await markUnwishlisted(db, me.fanId, itemKey);
      return null;
    },
  };
}
