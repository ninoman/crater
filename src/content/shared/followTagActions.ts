// What the tag editor's clicks do to followings, for one account or a bulk selection.

import type { FollowingKey, TagAction, TagResult } from '../../shared/following';

/** The tag mutations this needs; `useTags()` provides them. */
export interface TagMutations {
  create: (name: string) => Promise<TagResult>;
  assign: (tagId: number, keys: FollowingKey[], action: TagAction) => Promise<number>;
}

export interface FollowTagHandlers {
  /** Takes the tag off if every account has it, otherwise puts it on all of them. */
  onToggle: (tagId: number) => void;
  /** Creates the tag (or finds it by name) and puts it on every account. */
  onCreate: (name: string) => void;
}

/**
 * Handlers for `FollowTagEditor` or a bulk picker. `assignedIds` are the tags every one of `keys`
 * already has. Failures go to `onError`; the hooks refetch on success, so there's nothing to undo.
 */
export function followTagHandlers(
  mutations: TagMutations,
  keys: FollowingKey[],
  assignedIds: readonly number[],
  onError: (message: string) => void,
): FollowTagHandlers {
  const report = (error: unknown) =>
    onError(error instanceof Error ? error.message : String(error));
  return {
    onToggle(tagId) {
      const action: TagAction = assignedIds.includes(tagId) ? 'remove' : 'add';
      mutations.assign(tagId, keys, action).catch(report);
    },
    onCreate(name) {
      mutations
        .create(name)
        .then((result) => {
          if (!result.ok) throw new Error(`Couldn't create the tag (${result.reason}).`);
          return mutations.assign(result.tag.id, keys, 'add');
        })
        .catch(report);
    },
  };
}
