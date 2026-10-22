// The following tab's filter and selection over followings (decisions §8), from the shared
// tagged-list functions.

import type { Following } from '../../shared/following';
import {
  commonTagIds as commonTags,
  type TaggedRows,
  type TagFilter,
  visibleKeys,
} from '../shared/tagFilter';

export {
  actionable,
  isFiltering,
  liveTagIds,
  NO_FILTER,
  toggled,
  type TagFilter as FollowingFilter,
} from '../shared/tagFilter';

const FOLLOWINGS: TaggedRows<Following, number> = {
  keyOf: (row) => row.id,
  tagIdsOf: (row) => row.tagIds,
  textOf: (row) => row.name,
};

/** Ids of the rows passing the tag filter and the name search. */
export function visibleIds(rows: readonly Following[], filter: TagFilter): Set<number> {
  return visibleKeys(rows, filter, FOLLOWINGS);
}

/** Tags every one of `ids` has, so the bulk picker can show them as assigned. */
export function commonTagIds(rows: readonly Following[], ids: readonly number[]): number[] {
  return commonTags(rows, ids, FOLLOWINGS);
}
