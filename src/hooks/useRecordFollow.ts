import { FOLLOW_ACTION } from '../bandcamp';
import type { SyncedFollowing } from '../shared/following';
import { sendMessage } from '../shared/messages';
import { notifyFollowingChanged } from './followingChanges';
import { usePageActionChange } from './usePageActionChange';

/** The account a page's Follow button follows. */
export type FollowedAccount = Omit<SyncedFollowing, 'followedAt'>;

/**
 * Watches Bandcamp's Follow button for `account` and saves a follow or unfollow at once, so the
 * page's tag editor shows without a sync (decisions §21). No picker opens: Bandcamp's
 * mailing-list dialog after a follow would take its focus and close it.
 */
export function useRecordFollow(doc: Document, account: FollowedAccount): void {
  usePageActionChange(doc, FOLLOW_ACTION, (change) => {
    const { kind, id } = account;
    const saved =
      change === 'on'
        ? sendMessage('markFollowed', { account: { ...account, followedAt: Date.now() } })
        : sendMessage('setUnfollowed', { key: [kind, id], unfollowed: true });
    saved
      .then(notifyFollowingChanged)
      .catch((error: unknown) => console.warn('dighead: could not save the follow', error));
  });
}
