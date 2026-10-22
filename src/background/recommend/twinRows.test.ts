import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { CollectionItem, ItemKey, Supporter } from '../../bandcamp';
import {
  DigheadDb,
  finishFanScan,
  markSynced,
  putFollowing,
  putOwnership,
  replaceTwins,
  saveViewer,
  upsertCollectionItems,
  upsertSupporterFans,
  type TwinRecord,
} from '../../db';
import { TWIN_BUYS } from './twinBuys';
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

function item(itemKey: ItemKey, addedAt: number | null): CollectionItem {
  return {
    itemKey,
    albumKey: null,
    title: `Title ${itemKey}`,
    artist: `Artist ${itemKey}`,
    bandId: 1,
    url: `https://artist.bandcamp.com/album/${itemKey}`,
    artId: null,
    purchaseKind: 'album',
    label: null,
    labelId: null,
    otherOwners: null,
    addedAt,
    compilation: false,
  };
}

function twin(fanId: number, score: number, overrides: Partial<TwinRecord> = {}): TwinRecord {
  return {
    fanId,
    overlap: 3,
    jaccard: 0.1,
    score,
    labelCluster: false,
    lately: null,
    yearAgo: null,
    latelyOverlap: 0,
    computedAt: 7,
    ...overrides,
  };
}

describe('readTwinsResult', () => {
  it('says there is no viewer before you are seen logged in', async () => {
    expect(await readTwinsResult(db, 6)).toEqual({
      basis: 'no-viewer',
      rows: [],
      latelyRows: [],
      latelyHalfLifeMonths: 6,
      computedAt: null,
      fansRead: 0,
    });
  });

  it('says your collection is unsynced until the first sync ends', async () => {
    await saveViewer(db, { fanId: 1, username: 'me' });
    expect((await readTwinsResult(db, 6)).basis).toBe('unsynced');

    await markSynced(db, 5);
    expect((await readTwinsResult(db, 6)).basis).toBe('ready');
  });

  it('ranks by score and adds names, avatars and profile links', async () => {
    await saveViewer(db, { fanId: 1, username: 'me' });
    await upsertSupporterFans(db, [supporter(10, 'Ten', 2053905), supporter(11, '')], 0);
    await finishFanScan(db, 10, 'done', 40, 0);
    await finishFanScan(db, 11, 'partial', 20, 0);
    await replaceTwins(db, [twin(11, 0.2), twin(10, 0.5, { labelCluster: true })], []);

    const result = await readTwinsResult(db, 6);

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
        followed: false,
        lately: null,
        latelyOverlap: 0,
        trend: 'quiet',
        recentBuys: [],
      },
      expect.objectContaining({ fanId: 11, rank: 2, name: 'fan11', avatarUrl: null }),
    ]);
  });

  it('marks fans you follow on both boards without moving them', async () => {
    await saveViewer(db, { fanId: 1, username: 'me' });
    await upsertSupporterFans(db, [supporter(10, 'Ten'), supporter(11, 'Eleven')], 0);
    const ten = twin(10, 0.5, { lately: 0.1 });
    const eleven = twin(11, 0.2, { lately: 0.3 });
    await replaceTwins(db, [ten, eleven], [eleven, ten]);
    await putFollowing(db, [
      {
        kind: 'fan',
        id: 11,
        name: 'Eleven',
        url: '',
        imageId: null,
        location: null,
        followedAt: 0,
      },
      { kind: 'band', id: 10, name: 'Band', url: '', imageId: null, location: null, followedAt: 0 },
    ]);

    const result = await readTwinsResult(db, 6);

    expect(result.rows.map((row) => [row.fanId, row.rank, row.followed])).toEqual([
      [10, 1, false],
      [11, 2, true],
    ]);
    expect(result.latelyRows.map((row) => [row.fanId, row.followed])).toEqual([
      [11, true],
      [10, false],
    ]);
  });

  it('ranks the lately board by lately score, with its own ranks and trends', async () => {
    await saveViewer(db, { fanId: 1, username: 'me' });
    await upsertSupporterFans(db, [supporter(10, 'Ten'), supporter(11, 'Eleven')], 0);
    const ten = twin(10, 0.5, { lately: 0.1, yearAgo: 0.4, latelyOverlap: 2 });
    const eleven = twin(11, 0.2, { lately: 0.3, yearAgo: null, latelyOverlap: 6 });
    await replaceTwins(db, [ten, eleven], [eleven, ten]);

    const result = await readTwinsResult(db, 6);

    expect(result.rows.map((row) => [row.fanId, row.rank])).toEqual([
      [10, 1],
      [11, 2],
    ]);
    expect(result.latelyRows).toEqual([
      expect.objectContaining({ fanId: 11, rank: 1, lately: 0.3, latelyOverlap: 6, trend: 'new' }),
      expect.objectContaining({ fanId: 10, rank: 2, lately: 0.1, trend: 'drifting' }),
    ]);
  });

  it('shows what each twin bought last, newest first, on both boards', async () => {
    await saveViewer(db, { fanId: 1, username: 'me' });
    await upsertSupporterFans(db, [supporter(10, 'Ten'), supporter(11, 'Eleven')], 0);
    const bought = Array.from({ length: TWIN_BUYS + 2 }, (_, i) =>
      item(`a${i + 1}` as ItemKey, (i + 1) * 100),
    );
    const undated = item('a99' as ItemKey, null);
    await upsertCollectionItems(db, [...bought, undated], 0);
    await putOwnership(db, 10, [...bought, undated], 'collection');
    await replaceTwins(db, [twin(10, 0.5), twin(11, 0.2)], [twin(10, 0.5, { lately: 0.1 })]);

    const result = await readTwinsResult(db, 6);

    const buys = result.rows[0]?.recentBuys ?? [];
    expect(buys).toHaveLength(TWIN_BUYS);
    expect(buys[0]).toEqual({
      matchKey: `a${TWIN_BUYS + 2}`,
      title: `Title a${TWIN_BUYS + 2}`,
      artist: `Artist a${TWIN_BUYS + 2}`,
      url: `https://artist.bandcamp.com/album/a${TWIN_BUYS + 2}`,
      coverUrl: null,
      boughtAt: (TWIN_BUYS + 2) * 100,
    });
    expect(buys.map((buy) => buy.boughtAt)).toEqual(
      [...buys.map((buy) => buy.boughtAt)].sort((a, b) => b - a),
    );
    expect(result.rows[1]?.recentBuys).toEqual([]);
    expect(result.latelyRows[0]?.recentBuys).toEqual(buys);
  });
});
