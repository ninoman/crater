import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ItemKey } from '../../bandcamp';
import { DigheadDb, type FollowKind, type ItemRecord } from '../schema';
import { followedFanIds, gatherFollowedBandReleases, isFollowedFan } from './followSignal';
import { putFollowing, setUnfollowed } from './following';

function follow(kind: FollowKind, id: number, name = `Account ${id}`) {
  return { kind, id, name, url: '', imageId: null, location: null, followedAt: id };
}

function item(
  itemKey: ItemKey,
  bandId: number,
  labelId: number | null = null,
  albumKey: ItemKey | null = null,
): ItemRecord {
  return {
    itemKey,
    albumKey,
    title: itemKey,
    artist: 'Artist',
    bandId,
    label: null,
    labelId,
    url: '',
    artId: null,
    tags: [],
    supporterCount: null,
    fetchedAt: 0,
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

describe('gatherFollowedBandReleases', () => {
  it('finds releases by seller and by label, tracks under their album', async () => {
    await putFollowing(db, [
      follow('band', 1, 'Warp'),
      follow('band', 2, 'Label'),
      follow('fan', 3),
    ]);
    await db.items.bulkPut([
      item('a10', 1),
      item('t11', 1, null, 'a10'),
      item('a20', 9, 2),
      item('a30', 9),
    ]);

    const { bands, releases } = await gatherFollowedBandReleases(db);

    expect(bands).toEqual(
      new Map([
        [1, 'Warp'],
        [2, 'Label'],
      ]),
    );
    expect(releases).toEqual(
      expect.arrayContaining([
        { id: 10, bandId: 1, labelId: null },
        { id: 20, bandId: 9, labelId: 2 },
      ]),
    );
    expect(releases.every((r) => r.id !== 30)).toBe(true);
    expect(releases.filter((r) => r.id === 10)).toHaveLength(2);
  });

  it('skips accounts unfollowed on the tab', async () => {
    await putFollowing(db, [follow('band', 1)]);
    await setUnfollowed(db, ['band', 1], true);
    await db.items.put(item('a10', 1));

    expect(await gatherFollowedBandReleases(db)).toEqual({ bands: new Map(), releases: [] });
  });
});

describe('followedFanIds', () => {
  it('lists followed fans only', async () => {
    await putFollowing(db, [follow('fan', 5), follow('fan', 6), follow('band', 7)]);
    await setUnfollowed(db, ['fan', 6], true);

    expect(await followedFanIds(db)).toEqual(new Set([5]));
    expect(await isFollowedFan(db, 5)).toBe(true);
    expect(await isFollowedFan(db, 6)).toBe(false);
    expect(await isFollowedFan(db, 7)).toBe(false);
  });
});
