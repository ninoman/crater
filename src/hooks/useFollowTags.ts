import type { FollowKind } from '../shared/following';
import { sendMessage } from '../shared/messages';
import { type QueryView, useFollowingQuery } from './useFollowingQuery';

/** Tag ids on an account, or null when you don't follow it. */
export type FollowTagsView = QueryView<number[] | null>;

/** The tags on one account, for the chips on its own page. */
export function useFollowTags(kind: FollowKind, id: number): FollowTagsView {
  return useFollowingQuery(`${kind}:${id}`, () => sendMessage('getFollowTags', { kind, id }));
}
