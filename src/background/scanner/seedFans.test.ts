import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ItemKey } from '../../bandcamp';
import { CraterDb, enqueueAt, fanJob, putFollowing, refreshFanMatches } from '../../db';
import { SEED, SEED_FANS } from './priority';
import { rankSeedFansOnceListed } from './seedFans';

const ME = 1;
const NOW = 1_800_000_000_000;

let db: CraterDb;

beforeEach(async () => {
  db = new CraterDb(`test-${crypto.randomUUID()}`);
  await db.open();
  await db.me.put({ id: 'self', fanId: ME, username: 'me', syncedAt: NOW });
});

afterEach(async () => {
  await db.delete();
});

/** Each fan owns these releases, as a supporter list or their collection would record it. */
async function owners(byFan: Record<number, ItemKey[]>): Promise<void> {
  await db.ownership.bulkPut(
    Object.entries(byFan).flatMap(([fanId, keys]) =>
      keys.map((itemKey) => ({
        fanId: Number(fanId),
        itemKey,
        matchKey: itemKey,
        source: 'collection' as const,
        addedAt: null,
      })),
    ),
  );
  await refreshFanMatches(db, Object.keys(byFan).map(Number));
}

/** Bandcamp's supporter count per release, which sets its rarity weight. */
async function supporterCounts(counts: Record<ItemKey, number>): Promise<void> {
  await db.items.bulkPut(
    Object.entries(counts).map(([itemKey, supporterCount]) => ({
      itemKey: itemKey as ItemKey,
      albumKey: null,
      title: itemKey,
      artist: 'Artist',
      bandId: 1,
      label: null,
      labelId: null,
      url: `https://artist.bandcamp.com/${itemKey}`,
      artId: null,
      tags: [],
      supporterCount,
      compilation: false,
      fetchedAt: 0,
    })),
  );
}

/** Queues seed fan scans in page order, as seed lists leave them. */
async function queueSeedFans(fanIds: number[]): Promise<void> {
  await enqueueAt(
    db,
    fanIds.map((fanId, i) => ({ spec: fanJob(fanId, 'a1'), at: 0, rank: i + 1 })),
    SEED_FANS,
  );
}

async function order(): Promise<number[]> {
  const jobs = await db.queue.orderBy('[priority+nextAttemptAt+rank]').toArray();
  return jobs.filter((job) => job.kind === 'fan').map((job) => Number(job.target));
}

describe('rankSeedFansOnceListed', () => {
  beforeEach(async () => {
    // a1 and a2 are rare releases of yours, a3 and a4 hits; a9 isn't yours.
    await supporterCounts({ a1: 20, a2: 20, a3: 18_000, a4: 18_000, a9: 5 });
    await owners({
      [ME]: ['a1', 'a2', 'a3', 'a4'],
      11: ['a1', 'a9'],
      12: ['a3', 'a4'],
      13: ['a1', 'a2'],
      14: ['a3'],
    });
    await queueSeedFans([11, 12, 13, 14]);
  });

  it('ranks across all your releases: fans on two or more first, rarer ones ahead', async () => {
    await rankSeedFansOnceListed(db, NOW);
    expect(await order()).toEqual([13, 12, 11, 14]);
  });

  it('waits while another seed list is due, but not for one waiting on a retry', async () => {
    const list = (target: ItemKey) => ({
      spec: { kind: 'release' as const, target, url: `https://artist.bandcamp.com/${target}` },
      at: -1,
    });
    await enqueueAt(db, [list('a2')], SEED);
    await rankSeedFansOnceListed(db, NOW);
    expect(await order()).toEqual([11, 12, 13, 14]);

    await db.queue
      .where('[kind+target]')
      .equals(['release', 'a2'])
      .modify({ nextAttemptAt: NOW + 1 });
    await rankSeedFansOnceListed(db, NOW);
    expect(await order()).toEqual([13, 12, 11, 14]);
  });

  it('leaves out the list that just finished, which is still queued', async () => {
    const spec = { kind: 'release' as const, target: 'a2' as const, url: 'https://x/a2' };
    await enqueueAt(db, [{ spec, at: -1 }], SEED);
    const finishing = await db.queue.where('[kind+target]').equals(['release', 'a2']).first();
    await rankSeedFansOnceListed(db, NOW, finishing?.id);
    expect(await order()).toEqual([13, 12, 11, 14]);
  });

  it('reads fans you follow first', async () => {
    await putFollowing(db, [
      {
        kind: 'fan',
        id: 14,
        name: 'Friend',
        url: '',
        imageId: null,
        location: null,
        followedAt: 0,
      },
    ]);
    await rankSeedFansOnceListed(db, NOW);
    expect(await order()).toEqual([14, 13, 12, 11]);
  });

  it("doesn't move scans that have started", async () => {
    await db.queue
      .where('[kind+target]')
      .equals(['fan', '14'])
      .modify({ rank: 0, cursor: { stage: 'full', token: 'x', scanned: 0 } });
    await rankSeedFansOnceListed(db, NOW);
    expect(await order()).toEqual([14, 13, 12, 11]);
  });
});
