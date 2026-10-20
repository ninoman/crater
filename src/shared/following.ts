// Shapes of followings and tags on the message bus, shared by the worker and the pages.
// The types live with the database; this is the one place UI code imports them from.

export type {
  FollowingKey,
  FollowingRecord as Following,
  FollowKind,
  TagRecord as Tag,
} from '../db/schema';
export { parseTagBackup, type TagBackup } from '../db/tagBackup';
export type { TagImportSummary, TagResult } from '../db/repo/tags';
export { matchesTags, type TagMode } from '../db/tagFilter';

/** Who `assignTag` changes: add the tag to the followings, or take it off. */
export type TagAction = 'add' | 'remove';
