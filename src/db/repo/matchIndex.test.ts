import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { keyFromNumber, type CollectionItem, type ItemKey, type Supporter } from '../../bandcamp';
import { buildMatchIndex, collectionMatches } from '../matchIndex';
import { DigheadDb, type OwnershipRecord } from '../schema';
import { hiddenMatchKeys, hideRelease } from './hidden';
import { getOwnerCounts } from './matchIndex';
import { addSupporterOwnership, putOwnership, removeOwnershipExcept } from './ownership';

function item(itemKey: ItemKey, albumKey: ItemKey | null = null): CollectionItem {
  return {
    itemKey,
    albumKey,
    title: 'Title',
    artist: 'Artist',
    bandId: 1,
    url: 'https://artist.bandcamp.com/album/title',
    artId: null,
    purchaseKind: albumKey ? 'track' : 'album',
    label: null,
    labelId: null,
    otherOwners: 3,
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
    purchasedAt: 1_700_000_000_000,
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

async function matchesOf(fanId: number) {
  const record = await db.fanMatches.get(fanId);
  return record && [...record.matchIds].map(keyFromNumber);
}

describe('buildMatchIndex', () => {
  it('folds tracks into their album and leaves wishlists out', () => {
    const rows: OwnershipRecord[] = [
      { fanId: 1, itemKey: 'a1', matchKey: 'a1', source: 'collection', addedAt: null },
      { fanId: 1, itemKey: 't2', matchKey: 'a1', source: 'collection', addedAt: null },
      { fanId: 2, itemKey: 't3', matchKey: 'a1', source: 'collection', addedAt: null },
      { fanId: 2, itemKey: 'a9', matchKey: 'a9', source: 'wishlist', addedAt: null },
      { fanId: 3, itemKey: 'a9', matchKey: 'a9', source: 'wishlist', addedAt: null },
    ];

    expect(buildMatchIndex(rows)).toEqual({
      fanMatches: [
        { fanId: 1, matchIds: Float64Array.from([1]), matchTimes: Float64Array.from([0]) },
        { fanId: 2, matchIds: Float64Array.from([1]), matchTimes: Float64Array.from([0]) },
      ],
      matchOwners: [{ matchId: 1, owners: 2 }],
    });
  });
});

describe('collectionMatches', () => {
  it('keeps the newest purchase under each release, 0 when none is dated', () => {
    const rows: OwnershipRecord[] = [
      { fanId: 1, itemKey: 't2', matchKey: 'a1', source: 'collection', addedAt: 100 },
      { fanId: 1, itemKey: 'a1', matchKey: 'a1', source: 'collection', addedAt: 300 },
      { fanId: 1, itemKey: 't3', matchKey: 'a1', source: 'collection', addedAt: null },
      { fanId: 1, itemKey: 'a5', matchKey: 'a5', source: 'collection', addedAt: null },
      { fanId: 1, itemKey: 'a4', matchKey: 'a4', source: 'wishlist', addedAt: 900 },
    ];

    expect(collectionMatches(rows)).toEqual({
      matchIds: Float64Array.from([1, 5]),
      matchTimes: Float64Array.from([300, 0]),
    });
  });
});

describe('match index upkeep', () => {
  it('follows collection pages, counting a fan once per release', async () => {
    await putOwnership(db, 1, [item('a1'), item('t2', 'a1')], 'collection');
    await putOwnership(db, 1, [item('t3', 'a1'), item('a4')], 'collection');
    await putOwnership(db, 2, [item('a4')], 'collection');
    await putOwnership(db, 2, [item('a5')], 'wishlist');

    expect(await matchesOf(1)).toEqual(['a1', 'a4']);
    expect(await matchesOf(2)).toEqual(['a4']);
    expect(await getOwnerCounts(db, [1, 4, 5])).toEqual(
      new Map([
        [1, 1],
        [4, 2],
      ]),
    );
  });

  it('drops removed items and fans left with nothing', async () => {
    await putOwnership(db, 1, [item('a1'), item('a2')], 'collection');
    await putOwnership(db, 2, [item('a2')], 'collection');

    await removeOwnershipExcept(db, 1, 'collection', new Set(['a1']));
    await removeOwnershipExcept(db, 2, 'collection', new Set());

    expect(await matchesOf(1)).toEqual(['a1']);
    expect(await db.fanMatches.get(2)).toBeUndefined();
    expect(await getOwnerCounts(db, [1, 2])).toEqual(new Map([[1, 1]]));
  });

  it('adds supporters as owners of the release they are listed under', async () => {
    await addSupporterOwnership(db, { itemKey: 't7', albumKey: 'a6' }, [
      supporter(1),
      supporter(2),
    ]);

    expect(await matchesOf(1)).toEqual(['a6']);
    expect(await getOwnerCounts(db, [6])).toEqual(new Map([[6, 2]]));
  });
});

describe('hidden', () => {
  it('keeps the first hide time', async () => {
    await hideRelease(db, 'a1', 10);
    await hideRelease(db, 'a1', 20);

    expect(await hiddenMatchKeys(db)).toEqual(new Set(['a1']));
    expect(await db.hidden.get('a1')).toEqual({ matchKey: 'a1', hiddenAt: 10 });
  });
});

describe('upgrade to v6', () => {
  it('adds purchase times to the match index and blanks lately on stored twins', async () => {
    const name = `test-${crypto.randomUUID()}`;
    const old = new Dexie(name);
    old.version(5).stores({
      ownership: '[fanId+itemKey], fanId, itemKey, matchKey',
      twins: 'fanId, score',
      fanMatches: 'fanId',
    });
    await old.table('ownership').bulkPut([
      { fanId: 1, itemKey: 'a1', matchKey: 'a1', source: 'collection', addedAt: 500 },
      { fanId: 1, itemKey: 'a2', matchKey: 'a2', source: 'collection', addedAt: null },
    ]);
    await old.table('fanMatches').put({ fanId: 1, matchIds: Float64Array.from([1, 2]) });
    await old.table('twins').put({ fanId: 2, overlap: 1, jaccard: 1, score: 1, computedAt: 0 });
    old.close();

    const upgraded = new DigheadDb(name);
    await upgraded.open();

    expect(await upgraded.fanMatches.get(1)).toEqual({
      fanId: 1,
      matchIds: Float64Array.from([1, 2]),
      matchTimes: Float64Array.from([500, 0]),
    });
    expect(await upgraded.twins.get(2)).toMatchObject({
      lately: null,
      yearAgo: null,
      latelyOverlap: 0,
    });
    expect(await upgraded.latelyTwins.count()).toBe(0);
    await upgraded.delete();
  });
});

describe('upgrade to v3', () => {
  it('builds the match index and blank labels from existing data', async () => {
    const name = `test-${crypto.randomUUID()}`;
    const old = new Dexie(name);
    old.version(2).stores({
      items: 'itemKey, bandId, albumKey',
      fans: 'fanId, status, collectionFetchedAt',
      ownership: '[fanId+itemKey], fanId, itemKey, matchKey',
      releaseSupporters: 'itemKey, *fanIds',
      me: 'id',
      twins: 'fanId, score',
      queue: '++id, &[kind+target], [priority+nextAttemptAt]',
    });
    await old.table('items').put({ itemKey: 'a1', bandId: 1, albumKey: null, title: 'T' });
    await old.table('ownership').bulkPut([
      { fanId: 1, itemKey: 'a1', matchKey: 'a1', source: 'collection', addedAt: null },
      { fanId: 2, itemKey: 't2', matchKey: 'a1', source: 'collection', addedAt: null },
    ]);
    old.close();

    const upgraded = new DigheadDb(name);
    await upgraded.open();

    expect(await upgraded.items.get('a1')).toMatchObject({ label: null, labelId: null });
    expect(await upgraded.matchOwners.get(1)).toEqual({ matchId: 1, owners: 2 });
    expect(await upgraded.fanMatches.count()).toBe(2);
    await upgraded.delete();
  });
});
