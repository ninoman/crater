import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ItemKey } from '../../bandcamp';
import { CraterDb, enqueue, nextJob, type OwnershipRecord } from '../../db';
import { SUPPORTERS_FRESH_MS } from './freshness';
import { BACKGROUND, SEED } from './priority';
import { ownReleaseProgress, ownReleases, seedOwnReleases } from './seed';

const ME = 1;
const NOW = 1_800_000_000_000;

let db: CraterDb;

beforeEach(async () => {
  db = new CraterDb(`test-${crypto.randomUUID()}`);
  await db.open();
});

afterEach(async () => {
  await db.delete();
});

function row(
  itemKey: ItemKey,
  addedAt: number | null,
  extra: Partial<OwnershipRecord> = {},
): OwnershipRecord {
  return { fanId: ME, itemKey, matchKey: itemKey, source: 'collection', addedAt, ...extra };
}

/** Saves your ownership rows, with an item (and its url) for each. */
async function own(rows: OwnershipRecord[]): Promise<void> {
  await db.ownership.bulkPut(rows);
  await db.items.bulkPut(
    rows.map((r) => ({
      itemKey: r.itemKey,
      albumKey: r.matchKey === r.itemKey ? null : r.matchKey,
      title: r.itemKey,
      artist: 'Artist',
      bandId: 1,
      label: null,
      labelId: null,
      url: `https://artist.bandcamp.com/${r.itemKey}`,
      artId: null,
      tags: [],
      supporterCount: null,
      compilation: false,
      fetchedAt: 0,
    })),
  );
}

async function queuedTargets(): Promise<string[]> {
  const targets: string[] = [];
  for (let job = await nextJob(db, NOW); job; job = await nextJob(db, NOW)) {
    targets.push(job.target);
    if (job.id !== undefined) await db.queue.delete(job.id);
  }
  return targets;
}

describe('ownReleases', () => {
  it('keeps one release per matchKey, newest purchase first: the album when owned, else your tracks and the album', () => {
    expect(
      ownReleases([
        row('a1', 100),
        row('t2', 300, { matchKey: 'a1' }),
        row('t3', 200, { matchKey: 'a4' }),
        row('t5', 250, { matchKey: 'a4' }),
        row('a6', null),
      ]),
    ).toEqual([
      { matchKey: 'a1', addedAt: 300, targets: ['a1'], itemKeys: ['a1', 't2'] },
      { matchKey: 'a4', addedAt: 250, targets: ['t5', 't3', 'a4'], itemKeys: ['t3', 't5'] },
      { matchKey: 'a6', addedAt: null, targets: ['a6'], itemKeys: ['a6'] },
    ]);
  });
});

describe('seedOwnReleases', () => {
  it('queues your releases at seed priority, newest purchase first, one per matchKey', async () => {
    await own([row('a1', 100), row('t2', 300, { matchKey: 'a1' }), row('a3', 200)]);
    await db.ownership.put(row('a9', 400, { source: 'wishlist' }));

    expect(await seedOwnReleases(db, ME, NOW)).toBe(2);

    const jobs = await db.queue.toArray();
    expect(jobs.every((job) => job.priority === SEED)).toBe(true);
    expect(jobs.find((job) => job.target === 'a1')).toMatchObject({
      url: 'https://artist.bandcamp.com/a1',
    });
    expect(await queuedTargets()).toEqual(['a1', 'a3']);
  });

  it('queues each of your tracks when you only own tracks of an album', async () => {
    await own([row('t2', 100, { matchKey: 'a1' }), row('t3', 200, { matchKey: 'a1' })]);

    // The album has no item yet, so its URL comes from the first track page read.
    expect(await seedOwnReleases(db, ME, NOW)).toBe(2);
    expect((await queuedTargets()).sort()).toEqual(['t2', 't3']);
  });

  it('skips releases whose supporters are still fresh', async () => {
    await own([row('a1', 100), row('a2', 200)]);
    await db.releaseSupporters.bulkPut([
      { itemKey: 'a1', fanIds: [], fetchedAt: NOW - 1000 },
      { itemKey: 'a2', fanIds: [], fetchedAt: NOW - SUPPORTERS_FRESH_MS },
    ]);

    await seedOwnReleases(db, ME, NOW);

    expect(await queuedTargets()).toEqual(['a2']);
  });

  it('only adds the new releases after an incremental sync, ahead of older ones', async () => {
    await own([row('a1', 100), row('a2', 200)]);
    await seedOwnReleases(db, ME, NOW);
    await own([row('a3', 300)]);

    expect(await seedOwnReleases(db, ME, NOW + 1000, new Set(['a3']))).toBe(1);

    expect(await queuedTargets()).toEqual(['a3', 'a2', 'a1']);
  });

  it("doesn't demote a release already queued at a more urgent priority", async () => {
    await own([row('a1', 100)]);
    await enqueue(db, [{ kind: 'release', target: 'a1', url: 'u' }], BACKGROUND, NOW);

    await seedOwnReleases(db, ME, NOW);

    expect(await db.queue.toArray()).toEqual([
      expect.objectContaining({ target: 'a1', priority: BACKGROUND }),
    ]);
  });
});

describe('ownReleaseProgress', () => {
  it('counts your releases with a supporter list, whatever its age', async () => {
    await own([row('a1', 100), row('t2', 300, { matchKey: 'a1' }), row('a3', 200)]);
    await db.releaseSupporters.put({ itemKey: 'a1', fanIds: [], fetchedAt: 0 });

    expect(await ownReleaseProgress(db, ME)).toEqual({ scanned: 1, total: 2 });
  });

  it('counts a track-only release once its tracks and the album are all listed', async () => {
    await own([row('t2', 100, { matchKey: 'a1' })]);
    await db.releaseSupporters.put({ itemKey: 't2', fanIds: [], fetchedAt: 0 });
    expect(await ownReleaseProgress(db, ME)).toEqual({ scanned: 0, total: 1 });

    await db.releaseSupporters.put({ itemKey: 'a1', fanIds: [], fetchedAt: 0 });
    expect(await ownReleaseProgress(db, ME)).toEqual({ scanned: 1, total: 1 });
  });
});
