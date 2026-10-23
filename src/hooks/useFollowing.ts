import { useCallback, useMemo, useRef } from 'react';
import {
  type Following,
  type FollowingKey,
  type FollowKind,
  sameFollowing,
  type TagMode,
} from '../shared/following';
import { sendMessage } from '../shared/messages';
import { notifyFollowingChanged } from './followingChanges';
import { reuseUnchanged } from './reuseUnchanged';
import { type QueryView, useFollowingQuery } from './useFollowingQuery';

export type FollowingView = QueryView<readonly Following[]>;

const byId = (row: Following) => String(row.id);

/**
 * Followings of one kind passing the tag filter, newest first. Rows that didn't change keep
 * their object across refetches, so only their cards' changed parts re-render.
 */
export function useFollowing(
  kind: FollowKind,
  tagIds: number[],
  mode: TagMode,
): {
  view: FollowingView;
  setUnfollowed: (key: FollowingKey, unfollowed: boolean) => Promise<void>;
} {
  const query = useFollowingQuery(`${kind}:${mode}:${[...tagIds].sort().join(',')}`, () =>
    sendMessage('listFollowing', { kind, tagIds, mode }),
  );
  const last = useRef<readonly Following[]>([]);
  const view = useMemo((): FollowingView => {
    if (query.state !== 'ready') return query;
    last.current = reuseUnchanged(last.current, query.data, byId, sameFollowing);
    return { state: 'ready', data: last.current };
  }, [query]);

  const setUnfollowed = useCallback(async (key: FollowingKey, unfollowed: boolean) => {
    await sendMessage('setUnfollowed', { key, unfollowed });
    notifyFollowingChanged();
  }, []);

  return { view, setUnfollowed };
}
