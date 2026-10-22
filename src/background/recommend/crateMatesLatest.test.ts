import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { CollectionItem, ItemKey } from '../../bandcamp';
import {
  DigheadDb,
  enqueue,
  fanJob,
  getMe,
  hideRelease,
  markSynced,
  putOwnership,
  replaceCrateMates,
  saveViewer,
  upsertCollectionItems,
  upsertSupporterFans,
  type CrateMateRecord,
} from '../../db';
import { computeCrateMatesLatest, LATEST_WINDOW_DAYS } from './crateMatesLatest';

const ME = 1;
const DAY = 24 * 60 * 60 * 1000;
const NOW = 1000 * DAY;

let db: DigheadDb;

beforeEach(async () => {
  db = new DigheadDb(`test-${crypto.randomUUID()}`);
  await db.open();
});

afterEach(async () => {
  await db.delete();
});

function item(
  itemKey: ItemKey,
  daysAgo: number | null,
  album: ItemKey | null = null,
): CollectionItem {
  return {
    itemKey,
    albumKey: album,
    title: `Title ${itemKey}`,
    artist: `Artist ${itemKey}`,
    bandId: 1,
    url: `https://artist.bandcamp.com/album/${itemKey}`,
    artId: null,
    purchaseKind: album ? 'track' : 'album',
    label: null,
    labelId: null,
    otherOwners: null,
    addedAt: daysAgo === null ? null : NOW - daysAgo * DAY,
    compilation: false,
  };
}

async function own(
  fanId: number,
  items: CollectionItem[],
  source: 'collection' | 'wishlist' = 'collection',
) {
  await upsertCollectionItems(db, items);
  await putOwnership(db, fanId, items, source);
}

function crateMate(fanId: number, score: number): CrateMateRecord {
  return {
    fanId,
    overlap: 3,
    jaccard: 0.1,
    score,
    labelCluster: false,
    lately: score,
    yearAgo: null,
    latelyOverlap: 1,
    computedAt: 0,
  };
}

async function me() {
  await saveViewer(db, { fanId: ME, username: 'me' });
  await markSynced(db, 0);
  return getMe(db);
}

async function fans(ids: number[]) {
  await upsertSupporterFans(
    db,
    ids.map((fanId) => ({
      fanId,
      username: `fan${fanId}`,
      name: `Fan ${fanId}`,
      imageId: null,
      token: '',
      purchasedAt: null,
      isReviewer: false,
    })),
    0,
  );
}

describe('computeCrateMatesLatest', () => {
  it('lists what top crate mates bought lately and you lack, newest first, lately board first', async () => {
    await fans([10, 11, 12]);
    // 10 is your top lately crate mate, 11 your top all-time crate mate; 12 is outside both top 1s.
    await replaceCrateMates(
      db,
      [crateMate(11, 2), crateMate(12, 1)],
      [crateMate(10, 3), crateMate(12, 1)],
    );
    await own(ME, [item('a1', 400), item('a9', 400)]);
    await own(ME, [item('a8', 5)], 'wishlist');
    await own(10, [
      item('a2', 3),
      item('a3', 10),
      item('a1', 1),
      item('a4', LATEST_WINDOW_DAYS + 1),
    ]);
    await own(11, [item('a3', 2), item('a8', 1), item('a5', null)]);
    await own(12, [item('a6', 1)]);
    // An album you own a track of is left out (decisions §3.8).
    await own(ME, [item('t70', 400, 'a7')]);
    await own(11, [item('t71', 4, 'a7')]);
    await hideRelease(db, 'a2', 0);
    await enqueue(db, [fanJob(11)], 2, 0);

    const result = await computeCrateMatesLatest(db, await me(), 1, NOW);

    expect(result).toMatchObject({
      basis: 'ready',
      crateMatesUsed: 2,
      windowDays: 60,
      checking: 1,
    });
    expect(
      result.rows.map((row) => [
        row.matchKey,
        (NOW - row.boughtAt) / DAY,
        row.buyers.map((b) => b.name),
      ]),
    ).toEqual([['a3', 2, ['Fan 10', 'Fan 11']]]);
    expect(result.rows[0]?.buyers[0]?.url).toBe('https://bandcamp.com/fan10');
  });

  it('says why when there is no viewer', async () => {
    expect(await computeCrateMatesLatest(db, undefined, 30, NOW)).toMatchObject({
      basis: 'no-viewer',
      rows: [],
      crateMatesUsed: 0,
    });
  });
});
