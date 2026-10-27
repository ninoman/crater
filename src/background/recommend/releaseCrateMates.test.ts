import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { CollectionItem, ItemKey } from '../../bandcamp';
import {
  CraterDb,
  putOwnership,
  replaceCrateMates,
  upsertCollectionItems,
  upsertSupporterFans,
  type CrateMateRecord,
} from '../../db';
import { computeReleaseCrateMates } from './releaseCrateMates';

let db: CraterDb;

beforeEach(async () => {
  db = new CraterDb(`test-${crypto.randomUUID()}`);
  await db.open();
});

afterEach(async () => {
  await db.delete();
});

function item(itemKey: ItemKey, album: ItemKey | null = null): CollectionItem {
  return {
    itemKey,
    albumKey: album,
    title: `Title ${itemKey}`,
    artist: 'Artist',
    bandId: 1,
    url: `https://artist.bandcamp.com/album/${itemKey}`,
    artId: null,
    purchaseKind: album ? 'track' : 'album',
    label: null,
    labelId: null,
    otherOwners: 3,
    addedAt: null,
    compilation: false,
  };
}

function crateMate(fanId: number, score: number, labelCluster = false): CrateMateRecord {
  return {
    fanId,
    overlap: fanId,
    jaccard: 0.1,
    score,
    labelCluster,
    lately: null,
    yearAgo: null,
    latelyOverlap: 0,
    computedAt: 0,
  };
}

async function fan(fanId: number, items: CollectionItem[], source: 'collection' | 'wishlist') {
  await upsertCollectionItems(db, items);
  await upsertSupporterFans(
    db,
    [
      {
        fanId,
        username: `fan${fanId}`,
        name: fanId === 13 ? '' : `Fan ${fanId}`,
        imageId: null,
        token: `1:1:${fanId}:0:1:0`,
        purchasedAt: null,
        isReviewer: false,
      },
    ],
    0,
  );
  await putOwnership(db, fanId, items, source);
}

describe('computeReleaseCrateMates', () => {
  beforeEach(async () => {
    // Crate mates by rank: 11, 12, 13, 14. Fan 20 owns the album but isn't a crate mate.
    await replaceCrateMates(
      db,
      [crateMate(12, 0.5), crateMate(11, 0.9), crateMate(14, 0.1), crateMate(13, 0.2, true)],
      [],
    );
    await fan(11, [item('a1')], 'collection');
    await fan(12, [item('a2')], 'collection');
    await fan(13, [item('t2', 'a1')], 'collection');
    await fan(14, [item('a1')], 'wishlist');
    await fan(20, [item('a1')], 'collection');
  });

  it('lists the crate mates who collect the release, by leaderboard rank', async () => {
    expect(await computeReleaseCrateMates(db, 'a1')).toEqual({
      releaseKey: 'a1',
      crateMateCount: 4,
      rows: [
        {
          fanId: 11,
          rank: 1,
          name: 'Fan 11',
          profileUrl: 'https://bandcamp.com/fan11',
          overlap: 11,
          labelCluster: false,
        },
        // A track buyer counts; a blank name falls back to the username.
        {
          fanId: 13,
          rank: 3,
          name: 'fan13',
          profileUrl: 'https://bandcamp.com/fan13',
          overlap: 13,
          labelCluster: true,
        },
      ],
    });
  });

  it('finds album buyers from a track page', async () => {
    await upsertCollectionItems(db, [item('t3', 'a1')]);

    const result = await computeReleaseCrateMates(db, 't3');
    expect(result.rows.map((row) => row.fanId)).toEqual([11, 13]);
  });

  it('tells "no crate mates" apart from "none own this"', async () => {
    expect(await computeReleaseCrateMates(db, 'a9')).toMatchObject({ rows: [], crateMateCount: 4 });
    await replaceCrateMates(db, [], []);
    expect(await computeReleaseCrateMates(db, 'a1')).toMatchObject({ rows: [], crateMateCount: 0 });
  });
});
