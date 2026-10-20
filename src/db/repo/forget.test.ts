import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { keyToNumber, type CollectionItem, type Supporter } from '../../bandcamp';
import { DigheadDb } from '../schema';
import { clearAllData } from './clear';
import {
  countScannedFans,
  finishFanScan,
  forgetFansNotSeenSince,
  upsertSupporterFans,
} from './fans';
import { getOwnerCounts } from './matchIndex';
import { putOwnership } from './ownership';
import { enqueue, fanJob, countJobs } from './queue';
import { replaceTwins } from './twins';

const DAY = 24 * 60 * 60 * 1000;
const NOW = 400 * DAY;
const CUTOFF = NOW - 180 * DAY;

function item(itemKey: CollectionItem['itemKey']): CollectionItem {
  return {
    itemKey,
    albumKey: null,
    title: 'Title',
    artist: 'Artist',
    bandId: 1,
    url: 'https://artist.bandcamp.com/album/title',
    artId: null,
    purchaseKind: 'album',
    label: null,
    labelId: null,
    otherOwners: null,
    addedAt: null,
  };
}

function supporter(fanId: number): Supporter {
  return {
    fanId,
    username: `fan${fanId}`,
    name: `Fan ${fanId}`,
    imageId: null,
    token: `1:1700000000:${fanId}:0:1:0`,
    purchasedAt: null,
    isReviewer: false,
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

/** A fan seen at `seenAt` who owns `keys`. */
async function seedFan(fanId: number, seenAt: number, keys: CollectionItem['itemKey'][]) {
  await upsertSupporterFans(db, [supporter(fanId)], seenAt);
  await putOwnership(db, fanId, keys.map(item), 'collection');
}

describe('forgetFansNotSeenSince', () => {
  it('removes long-unseen fans with their rows and keeps owner counts right', async () => {
    const me = 1;
    await seedFan(me, 0, ['a1']); // you, listed as a supporter long ago
    await seedFan(2, NOW - 200 * DAY, ['a1', 'a2']);
    await seedFan(3, NOW - 10 * DAY, ['a1']);
    await seedFan(4, NOW - 300 * DAY, ['a2']);
    // Seen again recently, by a scan rather than a supporter list.
    await seedFan(5, NOW - 300 * DAY, ['a2']);
    await finishFanScan(db, 5, 'done', 1, NOW - DAY);
    await replaceTwins(
      db,
      [2, 3].map((fanId) => twin(fanId)),
    );
    await enqueue(db, [fanJob(4), fanJob(3)], 2, 0);

    expect(await forgetFansNotSeenSince(db, CUTOFF, me)).toBe(2);

    expect(await db.fans.toCollection().primaryKeys()).toEqual([1, 3, 5]);
    expect(await db.ownership.where('fanId').anyOf([2, 4]).count()).toBe(0);
    expect(await db.fanMatches.toCollection().primaryKeys()).toEqual([1, 3, 5]);
    const owners = await getOwnerCounts(db, [keyToNumber('a1'), keyToNumber('a2')]);
    expect(owners).toEqual(
      new Map([
        [keyToNumber('a1'), 2],
        [keyToNumber('a2'), 1],
      ]),
    );
    expect(await db.twins.toCollection().primaryKeys()).toEqual([3]);
    expect(await countJobs(db)).toEqual({ release: 0, fan: 1 });
  });

  it('works through more fans than one batch', async () => {
    await upsertSupporterFans(
      db,
      Array.from({ length: 250 }, (_, i) => supporter(i + 10)),
      0,
    );
    expect(await forgetFansNotSeenSince(db, CUTOFF, null)).toBe(250);
    expect(await db.fans.count()).toBe(0);
  });
});

describe('countScannedFans', () => {
  it('counts every final status', async () => {
    await upsertSupporterFans(db, [1, 2, 3].map(supporter), 0);
    await finishFanScan(db, 1, 'done', 0, 1);
    await finishFanScan(db, 2, 'error', 0, 1);
    expect(await countScannedFans(db)).toBe(2);
  });
});

describe('clearAllData', () => {
  it('empties every table', async () => {
    await seedFan(2, 0, ['a1']);
    await enqueue(db, [fanJob(2)], 2, 0);
    await clearAllData(db);
    const counts = await Promise.all(db.tables.map((table) => table.count()));
    expect(counts.every((count) => count === 0)).toBe(true);
  });
});

function twin(fanId: number) {
  return { fanId, overlap: 1, jaccard: 0.1, score: 1, labelCluster: false, computedAt: 0 };
}
