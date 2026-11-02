import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { CollectionItem, ItemKey, Supporter } from '../../bandcamp';
import {
  CraterDb,
  finishFanScan,
  putOwnership,
  saveReleaseSupporters,
  upsertCollectionItems,
  upsertSupporterFans,
} from '../../db';
import { releaseProgress } from './progress';

const RELEASE: ItemKey = 'a100';

let db: CraterDb;

beforeEach(async () => {
  db = new CraterDb(`test-${crypto.randomUUID()}`);
  await db.open();
});

afterEach(async () => {
  await db.delete();
});

const ITEM: CollectionItem = {
  itemKey: RELEASE,
  albumKey: null,
  title: 'Title',
  artist: 'Artist',
  bandId: 1,
  url: 'https://artist.bandcamp.com/album/a100',
  artId: 7,
  purchaseKind: 'album',
  label: null,
  labelId: null,
  otherOwners: 3,
  addedAt: null,
  compilation: false,
};

function supporter(fanId: number): Supporter {
  return {
    fanId,
    username: `fan${fanId}`,
    name: `Fan ${fanId}`,
    imageId: null,
    token: `${fanId}::a::`,
    purchasedAt: null,
    isReviewer: false,
  };
}

/** A fan owning the release, with their scan ended if `scanned`. */
async function owner(fanId: number, scanned: boolean) {
  await upsertSupporterFans(db, [supporter(fanId)], 0);
  await putOwnership(db, fanId, [ITEM], 'collection');
  if (scanned) await finishFanScan(db, fanId, 'done', 1, 0);
}

describe('releaseProgress', () => {
  beforeEach(async () => {
    await upsertCollectionItems(db, [ITEM]);
    await owner(10, true);
    await owner(11, false);
    await saveReleaseSupporters(db, RELEASE, [10, 11], 0);
  });

  it('adds scanned owners from outside the list, once each', async () => {
    await owner(20, true);
    await owner(21, true);

    expect(await releaseProgress(db, RELEASE)).toMatchObject({ scanned: 3, total: 4 });
  });

  it('leaves out queued owners from outside the list, so it can finish', async () => {
    await owner(20, false);
    expect(await releaseProgress(db, RELEASE)).toMatchObject({ scanned: 1, total: 2 });

    await finishFanScan(db, 11, 'done', 1, 0);
    expect(await releaseProgress(db, RELEASE)).toMatchObject({ scanned: 2, total: 2 });
  });
});
