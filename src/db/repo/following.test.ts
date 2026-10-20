import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FollowKind } from '../schema';
import { DigheadDb } from '../schema';
import {
  getFollowing,
  listFollowing,
  putFollowing,
  replaceFollowing,
  setUnfollowed,
  type SyncedFollowing,
} from './following';

function follow(kind: FollowKind, id: number, followedAt = id): SyncedFollowing {
  return {
    kind,
    id,
    name: `Account ${id}`,
    url: `https://bandcamp.com/account${id}`,
    imageId: null,
    location: null,
    followedAt,
  };
}

let db: DigheadDb;

beforeEach(async () => {
  db = new DigheadDb(`test-${crypto.randomUUID()}`);
  await db.open();
});

afterEach(async () => {
  await db.delete();
});

describe('putFollowing', () => {
  it('keeps tags when a sync saves the row again', async () => {
    await putFollowing(db, [follow('band', 1)]);
    await db.following.update(['band', 1], { tagIds: [5] });

    await putFollowing(db, [{ ...follow('band', 1), name: 'Renamed' }]);

    expect(await getFollowing(db, ['band', 1])).toMatchObject({ name: 'Renamed', tagIds: [5] });
  });

  it('clears the unfollowed mark of a row Bandcamp still lists', async () => {
    await putFollowing(db, [follow('fan', 1)]);
    await setUnfollowed(db, ['fan', 1], true);

    await putFollowing(db, [follow('fan', 1)]);

    expect((await getFollowing(db, ['fan', 1]))?.unfollowed).toBe(false);
  });
});

describe('replaceFollowing', () => {
  it('deletes rows of that kind that are gone, with their tags', async () => {
    await putFollowing(db, [follow('band', 1), follow('band', 2), follow('fan', 1)]);
    await db.following.update(['band', 2], { tagIds: [5] });

    await replaceFollowing(db, 'band', [follow('band', 1)]);

    expect(await db.following.toCollection().primaryKeys()).toEqual([
      ['band', 1],
      ['fan', 1],
    ]);
    expect(await db.following.where('tagIds').equals(5).count()).toBe(0);
  });

  it('deletes a row still unfollowed and keeps a re-followed one', async () => {
    await putFollowing(db, [follow('fan', 1), follow('fan', 2)]);
    await setUnfollowed(db, ['fan', 1], true);
    await setUnfollowed(db, ['fan', 2], true);
    await setUnfollowed(db, ['fan', 2], false);

    await replaceFollowing(db, 'fan', [follow('fan', 2)]);

    expect(await getFollowing(db, ['fan', 1])).toBeUndefined();
    expect((await getFollowing(db, ['fan', 2]))?.unfollowed).toBe(false);
  });
});

describe('listFollowing', () => {
  beforeEach(async () => {
    await putFollowing(db, [follow('band', 1, 10), follow('band', 2, 30), follow('fan', 3, 20)]);
    await db.following.update(['band', 1], { tagIds: [1, 2] });
    await db.following.update(['band', 2], { tagIds: [2] });
    await db.following.update(['fan', 3], { tagIds: [3] });
  });

  const ids = async (tagIds: number[], mode: 'all' | 'any') =>
    (await listFollowing(db, { tagIds, mode })).map((row) => row.id);

  it('lists everything, newest follow first, with no tags selected', async () => {
    expect(await ids([], 'all')).toEqual([2, 3, 1]);
  });

  it('keeps rows with every selected tag in all mode', async () => {
    expect(await ids([2], 'all')).toEqual([2, 1]);
    expect(await ids([2, 1], 'all')).toEqual([1]);
    expect(await ids([1, 3], 'all')).toEqual([]);
  });

  it('keeps rows with any selected tag, once each, in any mode', async () => {
    expect(await ids([1, 2], 'any')).toEqual([2, 1]);
    expect(await ids([1, 3], 'any')).toEqual([3, 1]);
  });
});
