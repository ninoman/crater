// Message handlers for tags and followings. They only route to the repos; the rules live there.

import {
  assignTag,
  createTag,
  deleteTag,
  exportTags,
  getFollowing,
  getMe,
  importTags,
  listFollowing,
  listTags,
  markFollowed,
  renameTag,
  setUnfollowed,
  type DigheadDb,
} from '../db';
import type { MessageHandlers } from '../shared/messages';

export type FollowingHandlers = Pick<
  MessageHandlers,
  | 'listTags'
  | 'createTag'
  | 'renameTag'
  | 'deleteTag'
  | 'assignTag'
  | 'listFollowing'
  | 'getFollowTags'
  | 'markFollowed'
  | 'setUnfollowed'
  | 'exportTags'
  | 'importTags'
>;

export function followingHandlers(db: DigheadDb): FollowingHandlers {
  return {
    listTags: () => listTags(db),
    createTag: ({ name }) => createTag(db, name),
    renameTag: ({ id, name }) => renameTag(db, id, name),
    deleteTag: async ({ id }) => {
      await deleteTag(db, id);
      return null;
    },
    assignTag: ({ tagId, keys, action }) => assignTag(db, tagId, keys, action),
    listFollowing: async ({ kind, tagIds, mode }) =>
      (await listFollowing(db, { tagIds, mode })).filter((row) => row.kind === kind),
    getFollowTags: async ({ kind, id }) => {
      const row = await getFollowing(db, [kind, id]);
      // An unfollowed row only keeps its tags in case you follow again.
      return row && !row.unfollowed ? row.tagIds : null;
    },
    markFollowed: async ({ account }) => {
      await markFollowed(db, account);
      return null;
    },
    setUnfollowed: async ({ key, unfollowed }) => {
      await setUnfollowed(db, key, unfollowed);
      return null;
    },
    exportTags: () => exportTags(db),
    importTags: async ({ backup }) => importTags(db, backup, (await getMe(db))?.fanId ?? null),
  };
}
