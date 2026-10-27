// Message handlers for your wishlist and collection lists and the tags on their items. The
// rules live in the repos.

import { artUrl, keyToNumber } from '../bandcamp';
import {
  assignItemTag,
  getCrateMates,
  getItemTags,
  getMe,
  getPurchaseLists,
  heardKeys,
  listOwnedItems,
  markUnwishlisted,
  markWishlisted,
  type CraterDb,
  type OwnedRow,
} from '../db';
import { topCrateMates } from '../scoring/forYou';
import { crateMateOwnerCounts } from '../scoring/wishlistCrateMates';
import type { ListedItem } from '../shared/itemList';
import type { MessageHandlers } from '../shared/messages';

export type ItemListHandlers = Pick<
  MessageHandlers,
  'listItems' | 'getItemTags' | 'assignItemTag' | 'markWishlisted' | 'markUnwishlisted'
>;

/** How many of your top crate mates own each row's release, in row order. */
async function crateMateOwners(db: CraterDb, rows: readonly OwnedRow[], k: number) {
  const top = topCrateMates(await getCrateMates(db), k);
  const lists = await getPurchaseLists(
    db,
    top.map((crateMate) => crateMate.fanId),
  );
  return crateMateOwnerCounts(
    rows.map((row) => keyToNumber(row.matchKey)),
    lists.map((list) => list.matchIds),
  );
}

export function itemListHandlers(
  db: CraterDb,
  topCrateMatesK: () => Promise<number>,
): ItemListHandlers {
  return {
    // Before your first sync there's no `me`, so no lists yet.
    listItems: async ({ source }) => {
      const me = await getMe(db);
      if (!me) return [];
      const [rows, heard] = await Promise.all([
        listOwnedItems(db, me.fanId, source),
        heardKeys(db),
      ]);
      // Crate mates who own it only matters for what you might still buy.
      const owners =
        source === 'wishlist' ? await crateMateOwners(db, rows, await topCrateMatesK()) : [];
      return rows.map(({ item, addedAt, tagIds }, i): ListedItem => {
        return {
          itemKey: item.itemKey,
          title: item.title,
          artist: item.artist,
          label: item.label,
          url: item.url,
          coverUrl: item.artId === null ? null : artUrl(item.artId),
          addedAt,
          tagIds,
          crateMateOwners: owners[i] ?? 0,
          heard: heard.has(item.albumKey ?? item.itemKey),
        };
      });
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
