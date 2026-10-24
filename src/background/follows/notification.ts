// What the grouped notification says (decisions §22). Pure, so it's tested without Chrome.

import { notificationPicks, type DigestEntry } from '../../scoring/followsDigest';
import type { FollowsState } from './state';

/** Releases named in the message; the rest are counted. */
const NAMED = 3;

export interface FollowsNotification {
  title: string;
  message: string;
}

/**
 * One notification for the releases found since the later of your last visit and the last
 * notification, or null when there are none.
 */
export function followsNotification(
  entries: readonly DigestEntry[],
  { lastVisitAt, lastNotifiedAt }: FollowsState,
): FollowsNotification | null {
  const since = Math.max(lastVisitAt ?? 0, lastNotifiedAt ?? 0);
  const { picks, total } = notificationPicks(entries, since, NAMED);
  if (total === 0) return null;
  const names = picks.map((entry) => `${entry.artist} – ${entry.title}`);
  const more = total - picks.length;
  return {
    title: `${total} new ${total === 1 ? 'release' : 'releases'} from your follows`,
    message: more > 0 ? `${names.join('\n')}\nand ${more} more` : names.join('\n'),
  };
}
