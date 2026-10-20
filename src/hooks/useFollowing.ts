import { useCallback } from 'react';
import type { Following, FollowingKey, FollowKind, TagMode } from '../shared/following';
import { sendMessage } from '../shared/messages';
import { notifyFollowingChanged } from './followingChanges';
import { type QueryView, useFollowingQuery } from './useFollowingQuery';

export type FollowingView = QueryView<Following[]>;

/** Followings of one kind passing the tag filter, newest first. */
export function useFollowing(
  kind: FollowKind,
  tagIds: number[],
  mode: TagMode,
): {
  view: FollowingView;
  setUnfollowed: (key: FollowingKey, unfollowed: boolean) => Promise<void>;
} {
  const view = useFollowingQuery(`${kind}:${mode}:${[...tagIds].sort().join(',')}`, () =>
    sendMessage('listFollowing', { kind, tagIds, mode }),
  );

  const setUnfollowed = useCallback(async (key: FollowingKey, unfollowed: boolean) => {
    await sendMessage('setUnfollowed', { key, unfollowed });
    notifyFollowingChanged();
  }, []);

  return { view, setUnfollowed };
}
