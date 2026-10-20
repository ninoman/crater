// Your followings, from the always-full sync, and the tag filter over them (decisions §8).

import type { DigheadDb, FollowKind, FollowingKey, FollowingRecord } from '../schema';
import { matchesTags, type TagMode } from '../tagFilter';

/** A following as the sync sees it. Tags and the unfollowed mark are ours, not Bandcamp's. */
export type SyncedFollowing = Omit<FollowingRecord, 'tagIds' | 'unfollowed'>;

export interface FollowingFilter {
  tagIds: number[];
  mode: TagMode;
}

export function followingKey(row: Pick<FollowingRecord, 'kind' | 'id'>): FollowingKey {
  return [row.kind, row.id];
}

/**
 * Saves synced followings, keeping the tags of rows we already have. Bandcamp listing a row
 * means you follow it, so its unfollowed mark is cleared.
 */
export async function putFollowing(db: DigheadDb, rows: SyncedFollowing[]): Promise<void> {
  await db.transaction('rw', db.following, async () => {
    const existing = await db.following.bulkGet(rows.map(followingKey));
    await db.following.bulkPut(
      rows.map((row, i) => ({ ...row, tagIds: existing[i]?.tagIds ?? [], unfollowed: false })),
    );
  });
}

/** A full sync of one list: saves `rows` and deletes, with their tags, the rows that are gone. */
export async function replaceFollowing(
  db: DigheadDb,
  kind: FollowKind,
  rows: SyncedFollowing[],
): Promise<void> {
  await db.transaction('rw', db.following, async () => {
    const synced = new Set(rows.map((row) => row.id));
    await db.following
      .where('kind')
      .equals(kind)
      .filter((row) => !synced.has(row.id))
      .delete();
    await putFollowing(db, rows);
  });
}

/** Marks or clears an unfollow made on the tab, so a quick re-follow keeps the tags. */
export async function setUnfollowed(
  db: DigheadDb,
  key: FollowingKey,
  unfollowed: boolean,
): Promise<void> {
  await db.following.update(key, { unfollowed });
}

export function getFollowing(
  db: DigheadDb,
  key: FollowingKey,
): Promise<FollowingRecord | undefined> {
  return db.following.get(key);
}

/** Followings passing the tag filter, newest follow first. */
export async function listFollowing(
  db: DigheadDb,
  { tagIds, mode }: FollowingFilter,
): Promise<FollowingRecord[]> {
  const rows = await filteredRows(db, tagIds, mode);
  return rows.sort((a, b) => b.followedAt - a.followedAt);
}

async function filteredRows(
  db: DigheadDb,
  tagIds: number[],
  mode: TagMode,
): Promise<FollowingRecord[]> {
  const [first] = tagIds;
  if (first === undefined) return db.following.toArray();
  if (mode === 'any') return db.following.where('tagIds').anyOf(tagIds).distinct().toArray();
  // AND: the index narrows to rows with the first tag, the rest is checked in memory.
  const withFirst = await db.following.where('tagIds').equals(first).toArray();
  return withFirst.filter((row) => matchesTags(row.tagIds, tagIds, mode));
}
