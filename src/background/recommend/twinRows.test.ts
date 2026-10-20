import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Supporter } from '../../bandcamp';
import {
  DigheadDb,
  finishFanScan,
  markSynced,
  replaceTwins,
  saveViewer,
  upsertSupporterFans,
  type TwinRecord,
} from '../../db';
import { readTwinsResult } from './twinRows';

let db: DigheadDb;

beforeEach(async () => {
  db = new DigheadDb(`test-${crypto.randomUUID()}`);
  await db.open();
});

afterEach(async () => {
  await db.delete();
});

function supporter(fanId: number, name: string, imageId: number | null = null): Supporter {
  return {
    fanId,
    username: `fan${fanId}`,
    name,
    imageId,
    token: `1:1:${fanId}:0:1:0`,
    purchasedAt: null,
    isReviewer: false,
  };
}

function twin(fanId: number, score: number, overrides: Partial<TwinRecord> = {}): TwinRecord {
  return {
    fanId,
    overlap: 3,
    jaccard: 0.1,
    score,
    labelCluster: false,
    computedAt: 7,
    ...overrides,
  };
}

describe('readTwinsResult', () => {
  it('says there is no viewer before you are seen logged in', async () => {
    expect(await readTwinsResult(db)).toEqual({
      basis: 'no-viewer',
      rows: [],
      computedAt: null,
      fansRead: 0,
    });
  });

  it('says your collection is unsynced until the first sync ends', async () => {
    await saveViewer(db, { fanId: 1, username: 'me' });
    expect((await readTwinsResult(db)).basis).toBe('unsynced');

    await markSynced(db, 5);
    expect((await readTwinsResult(db)).basis).toBe('ready');
  });

  it('ranks by score and adds names, avatars and profile links', async () => {
    await saveViewer(db, { fanId: 1, username: 'me' });
    await upsertSupporterFans(db, [supporter(10, 'Ten', 2053905), supporter(11, '')], 0);
    await finishFanScan(db, 10, 'done', 40, 0);
    await finishFanScan(db, 11, 'partial', 20, 0);
    await replaceTwins(db, [twin(11, 0.2), twin(10, 0.5, { labelCluster: true })]);

    const result = await readTwinsResult(db);

    expect(result.computedAt).toBe(7);
    expect(result.fansRead).toBe(2);
    expect(result.rows).toEqual([
      {
        fanId: 10,
        rank: 1,
        username: 'fan10',
        name: 'Ten',
        avatarUrl: 'https://f4.bcbits.com/img/0002053905_42.jpg',
        url: 'https://bandcamp.com/fan10',
        overlap: 3,
        jaccard: 0.1,
        score: 0.5,
        labelCluster: true,
      },
      expect.objectContaining({ fanId: 11, rank: 2, name: 'fan11', avatarUrl: null }),
    ]);
  });
});
