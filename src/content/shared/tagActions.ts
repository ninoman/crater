// What the tag editor's clicks do, for one account or item or a bulk selection of them.

import type { ItemKey } from '../../bandcamp';
import type { FollowingKey, TagAction, TagResult } from '../../shared/following';

/** The tag mutations this needs; `useTags()` provides them. */
export interface TagMutations {
  create: (name: string) => Promise<TagResult>;
  assign: (tagId: number, keys: FollowingKey[], action: TagAction) => Promise<number>;
  assignItems: (tagId: number, itemKeys: ItemKey[], action: TagAction) => Promise<number>;
}

export interface TagHandlers {
  /** Takes the tag off if every target has it, otherwise puts it on all of them. */
  onToggle: (tagId: number) => void;
  /** Creates the tag (or finds it by name) and puts it on every target. */
  onCreate: (name: string) => void;
}

/** Puts a tag on, or takes it off, every target at once. */
type Assign = (tagId: number, action: TagAction) => Promise<number>;

/**
 * Handlers for `TagEditor` or a bulk picker. `assignedIds` are the tags every target already
 * has. Failures go to `onError`; the hooks refetch on success, so there's nothing to undo.
 */
function tagHandlers(
  create: TagMutations['create'],
  assign: Assign,
  assignedIds: readonly number[],
  onError: (message: string) => void,
): TagHandlers {
  const report = (error: unknown) =>
    onError(error instanceof Error ? error.message : String(error));
  return {
    onToggle(tagId) {
      assign(tagId, assignedIds.includes(tagId) ? 'remove' : 'add').catch(report);
    },
    onCreate(name) {
      create(name)
        .then((result) => {
          if (!result.ok) throw new Error(`Couldn't create the tag (${result.reason}).`);
          return assign(result.tag.id, 'add');
        })
        .catch(report);
    },
  };
}

/** Handlers that tag followings. */
export function followTagHandlers(
  mutations: TagMutations,
  keys: FollowingKey[],
  assignedIds: readonly number[],
  onError: (message: string) => void,
): TagHandlers {
  const assign: Assign = (tagId, action) => mutations.assign(tagId, keys, action);
  return tagHandlers(mutations.create, assign, assignedIds, onError);
}

/** Handlers that tag wishlist items. */
export function itemTagHandlers(
  mutations: TagMutations,
  itemKeys: ItemKey[],
  assignedIds: readonly number[],
  onError: (message: string) => void,
): TagHandlers {
  const assign: Assign = (tagId, action) => mutations.assignItems(tagId, itemKeys, action);
  return tagHandlers(mutations.create, assign, assignedIds, onError);
}
