// Shapes of followings and tags on the message bus, shared by the worker and the pages.
// The types live with the database; this is the one place UI code imports them from.

import type { FollowingRecord } from '../db/schema';

export type {
  FollowingKey,
  FollowingRecord as Following,
  FollowKind,
  TagRecord as Tag,
} from '../db/schema';
export { parseTagBackup, type TagBackup } from '../db/tagBackup';
export type { SyncedFollowing } from '../db/repo/following';
export type { TagImportSummary, TagResult } from '../db/repo/tags';
export { matchesTags, type TagMode } from '../db/tagFilter';

/** Who `assignTag` changes: add the tag to the followings, or take it off. */
export type TagAction = 'add' | 'remove';

/** Whether two reads of the same following would render the same card. */
export function sameFollowing(a: FollowingRecord, b: FollowingRecord): boolean {
  return (
    a.kind === b.kind &&
    a.id === b.id &&
    a.name === b.name &&
    a.url === b.url &&
    a.imageId === b.imageId &&
    a.location === b.location &&
    a.followedAt === b.followedAt &&
    a.unfollowed === b.unfollowed &&
    a.tagIds.length === b.tagIds.length &&
    a.tagIds.every((id, i) => id === b.tagIds[i])
  );
}
