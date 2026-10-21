import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { CollectionItem, ItemKey, Supporter } from '../../bandcamp';
import {
  DigheadDb,
  finishFanScan,
  markQuickRead,
  getLatelyTwins,
  getTwins,
  putOwnership,
  readTwinCandidates,
  removeOwnershipExcept,
  upsertCollectionItems,
  upsertSupporterFans,
  type FanStatus,
} from '../../db';
import { MONTH_MS } from '../../scoring/lately';
import { LABEL_CLUSTER_FACTOR } from '../../scoring/twins';
import { DEFAULT_SETTINGS, type Settings } from '../../shared/settings';
import { computeTwins } from './twins';

const ME = 1;

let db: DigheadDb;

beforeEach(async () => {
  db = new DigheadDb(`test-${crypto.randomUUID()}`);
  await db.open();
});

afterEach(async () => {
  await db.delete();
});

/** A release sold by `bandId`, owned by `owners` other fans as far as Bandcamp knows. */
function item(
  itemKey: ItemKey,
  bandId = 1,
  owners = 3,
  album: ItemKey | null = null,
): CollectionItem {
  return {
    itemKey,
    albumKey: album,
    title: `Title ${itemKey}`,
    artist: 'Artist',
    bandId,
    url: `https://artist.bandcamp.com/album/${itemKey}`,
    artId: null,
    purchaseKind: album ? 'track' : 'album',
    label: null,
    labelId: null,
    otherOwners: owners,
    addedAt: null,
  };
}

function supporter(fanId: number): Supporter {
  return {
    fanId,
    username: `fan${fanId}`,
    name: `Fan ${fanId}`,
    imageId: null,
    token: `1:1:${fanId}:0:1:0`,
    purchasedAt: null,
    isReviewer: false,
  };
}

async function fan(fanId: number, items: CollectionItem[], status: FanStatus = 'done') {
  await upsertCollectionItems(db, items, 0);
  await upsertSupporterFans(db, [supporter(fanId)], 0);
  await putOwnership(db, fanId, items, 'collection');
  if (status === 'quick') await markQuickRead(db, fanId, items.length, 0);
  else if (status !== 'queued') await finishFanScan(db, fanId, status, items.length, 0);
}

async function mine(items: CollectionItem[]) {
  await upsertCollectionItems(db, items, 0);
  await putOwnership(db, ME, items, 'collection');
}

const filler = (from: number, count: number, bandId = 9) =>
  Array.from({ length: count }, (_, i) => item(`a${from + i}`, bandId, 1000));

async function run(settings: Partial<Settings> = {}, now = 5) {
  return computeTwins(
    {
      db,
      settings: { ...DEFAULT_SETTINGS, minCollectionSize: 1, ...settings },
      now,
      yieldNow: async () => undefined,
    },
    ME,
  );
}

describe('computeTwins', () => {
  it('ranks fans by rare shared releases and stores the leaderboard', async () => {
    // a1, a2 are rare (2 owners), a3, a4 are hits (5,000 owners).
    await mine([item('a1', 1, 1), item('a2', 2, 1), item('a3', 3, 4999), item('a4', 4, 4999)]);
    await fan(10, [item('a1', 1, 1), item('a2', 2, 1), ...filler(100, 2)]);
    await fan(11, [item('a3', 3, 4999), item('a4', 4, 4999), ...filler(200, 2)]);
    await fan(12, [item('a1', 1, 1), ...filler(300, 3)]);
    await fan(13, filler(400, 4));

    const twins = await run();

    expect(twins.map((twin) => twin.fanId)).toEqual([10, 12, 11]);
    expect(twins[0]).toMatchObject({
      overlap: 2,
      jaccard: 2 / 6,
      labelCluster: false,
      computedAt: 5,
    });
    expect((await getTwins(db)).map((twin) => twin.fanId)).toEqual([10, 12, 11]);
  });

  it('folds tracks into albums and uses the album count for rarity', async () => {
    await mine([item('a1', 1, 1)]);
    await fan(10, [item('t11', 1, 999, 'a1'), ...filler(100, 3)]);

    const [twin] = await run();

    expect(twin).toMatchObject({ fanId: 10, overlap: 1 });
    // w(a1) = 1 / log2(2 + 2), from the album's own count, not the track's 1,000.
    expect(twin?.score).toBeCloseTo(0.5 / Math.sqrt(1 * 4));
  });

  it('leaves out you, unread or quick-read fans and fans outside the size range', async () => {
    await mine([item('a1')]);
    await fan(10, [item('a1')], 'private');
    await fan(11, [item('a1')], 'queued');
    await fan(14, [item('a1'), ...filler(300, 2)], 'quick');
    await fan(12, [item('a1'), ...filler(100, 5)]);
    await fan(13, [item('a1'), ...filler(200, 1)], 'partial');

    expect((await run({ minCollectionSize: 2, maxCollectionSize: 5 })).map((t) => t.fanId)).toEqual(
      [13],
    );
  });

  it('down-weights a fan who owns most of the label behind the overlap', async () => {
    // Label 7's local catalog is a1–a5. You own a1–a3.
    await mine([item('a1', 7), item('a2', 7), item('a3', 7), item('a6', 8)]);
    await fan(20, [item('a4', 7), item('a5', 7)]);
    await fan(10, [item('a1', 7), item('a2', 7), item('a3', 7), item('a4', 7), ...filler(100, 1)]);
    await fan(11, [item('a1', 7), item('a6', 8), ...filler(200, 3)]);

    const twins = await run();
    const subscriber = twins.find((twin) => twin.fanId === 10);
    const unweighted = (await run({ labelClusterDownweight: false })).find((t) => t.fanId === 10);

    expect(subscriber?.labelCluster).toBe(true);
    expect(twins.find((twin) => twin.fanId === 11)?.labelCluster).toBe(false);
    expect(subscriber?.score).toBeCloseTo((unweighted?.score ?? 0) * LABEL_CLUSTER_FACTOR);
  });

  it('replaces the old leaderboard, and empties it with no synced collection', async () => {
    await mine([item('a1')]);
    await fan(10, [item('a1')]);
    expect(await run()).toHaveLength(1);

    await removeOwnershipExcept(db, ME, 'collection', new Set());

    expect(await run()).toEqual([]);
    expect(await getTwins(db)).toEqual([]);
  });
});

describe('computeTwins lately', () => {
  const NOW = 1000 * MONTH_MS;
  /** `item`, bought that many months before NOW. */
  const bought = (monthsAgo: number, key: ItemKey, bandId = 1, owners = 3): CollectionItem => ({
    ...item(key, bandId, owners),
    addedAt: NOW - monthsAgo * MONTH_MS,
  });
  const recent = (from: number, count: number) =>
    Array.from({ length: count }, (_, i) => bought(1, `a${from + i}`, 9, 1000));

  it('keeps a second leaderboard of the fans in step with you lately', async () => {
    // You bought a1, a2 this month, a3–a6 four years ago.
    await mine([bought(1, 'a1'), bought(1, 'a2'), ...[3, 4, 5, 6].map((n) => bought(48, `a${n}`))]);
    // Old twin: four releases in common, all from four years ago, and nothing bought since.
    await fan(
      10,
      [3, 4, 5, 6].map((n) => bought(48, `a${n}`)),
    );
    // Lately: one release in common, bought this month, among other recent buys.
    await fan(11, [bought(1, 'a1'), ...recent(100, 6)]);
    // Bought a lot lately, but shares only an old release with you.
    await fan(12, [bought(48, 'a3'), ...recent(200, 8)]);

    const twins = await run({}, NOW);
    const lately = await getLatelyTwins(db);

    expect(twins.map((twin) => twin.fanId)).toEqual([10, 11, 12]);
    expect(twins[0]).toMatchObject({ lately: null, latelyOverlap: 0 });
    expect(lately.map((twin) => twin.fanId)).toEqual([11]);
    expect(lately[0]).toMatchObject({ latelyOverlap: 1, yearAgo: null, computedAt: NOW });
  });
});

describe('readTwinCandidates', () => {
  it('pages through fans in id order', async () => {
    await mine([item('a1')]);
    for (const fanId of [10, 11, 12]) await fan(fanId, [item('a1')]);

    const first = await readTwinCandidates(db, -Infinity, 2, ME);
    const second = await readTwinCandidates(db, first.next ?? 0, 2, ME);

    // You (fan 1) take a slot on the first page but aren't a candidate.
    expect(first.candidates.map((c) => c.fanId)).toEqual([10]);
    expect(second.candidates.map((c) => c.fanId)).toEqual([11, 12]);
    // A full page can't know it's the last one.
    const third = await readTwinCandidates(db, second.next ?? 0, 2, ME);
    expect(third).toEqual({ candidates: [], next: null });
  });
});
