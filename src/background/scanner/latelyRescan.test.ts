import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DigheadDb, enqueue, fanJob, type FanRecord, type CrateMateRecord } from '../../db';
import { DEFAULT_SETTINGS } from '../../shared/settings';
import {
  LATEST_READ_OVERLAP_MS,
  pickLatelyRescans,
  queueLatelyRescans,
  type RescanCandidate,
} from './latelyRescan';
import { LATELY_RESCAN } from './priority';

const DAY = 24 * 60 * 60 * 1000;
const NOW = 1000 * DAY;
const WEEKLY = { latelyRescanCrateMates: 3, latelyRescanDays: 7 };

function read(
  fanId: number,
  daysAgo: number,
  status: FanRecord['status'] = 'done',
): RescanCandidate {
  return { fanId, fan: { status, collectionFetchedAt: NOW - daysAgo * DAY } };
}

describe('pickLatelyRescans', () => {
  it('picks the top crate mates read at least the interval ago, best first, from just before that read', () => {
    const board = [read(1, 8), read(2, 7), read(3, 6), read(4, 30)];
    expect(pickLatelyRescans(board, new Set(), NOW, WEEKLY)).toEqual([
      { fanId: 1, since: NOW - 8 * DAY - LATEST_READ_OVERLAP_MS },
      { fanId: 2, since: NOW - 7 * DAY - LATEST_READ_OVERLAP_MS },
    ]);
  });

  it('skips crate mates with a scan already queued, or no full read on file', () => {
    const board = [
      read(1, 10),
      read(2, 10, 'quick'),
      { fanId: 3, fan: { status: 'done' as const, collectionFetchedAt: null } },
      { fanId: 4, fan: undefined },
      read(5, 10, 'partial'),
    ];
    const picked = pickLatelyRescans(board, new Set([1]), NOW, {
      ...WEEKLY,
      latelyRescanCrateMates: 5,
    });
    expect(picked.map((r) => r.fanId)).toEqual([5]);
  });

  it('picks nobody when turned off', () => {
    expect(
      pickLatelyRescans([read(1, 30)], new Set(), NOW, { ...WEEKLY, latelyRescanCrateMates: 0 }),
    ).toEqual([]);
  });
});

describe('queueLatelyRescans', () => {
  let db: DigheadDb;

  beforeEach(async () => {
    db = new DigheadDb(`test-${crypto.randomUUID()}`);
    await db.open();
  });

  afterEach(async () => {
    await db.delete();
  });

  function crateMate(fanId: number, lately: number): CrateMateRecord {
    return {
      fanId,
      overlap: 1,
      jaccard: 0,
      score: 0,
      labelCluster: false,
      lately,
      yearAgo: null,
      latelyOverlap: 1,
      computedAt: NOW,
    };
  }

  function fan(fanId: number, daysAgo: number): FanRecord {
    return {
      fanId,
      username: `f${fanId}`,
      name: `F${fanId}`,
      imageId: null,
      collectionSize: 10,
      scannedItems: 10,
      collectionFetchedAt: NOW - daysAgo * DAY,
      status: 'done',
      lastSeenAt: NOW,
    };
  }

  it('queues latest reads at their own priority, in lately order, leaving queued fans alone', async () => {
    await db.latelyCrateMates.bulkPut([
      crateMate(1, 0.2),
      crateMate(2, 0.9),
      crateMate(3, 0.5),
      crateMate(4, 0.1),
    ]);
    await db.fans.bulkPut([fan(1, 10), fan(2, 10), fan(3, 10), fan(4, 10)]);
    await enqueue(db, [fanJob(3)], 2, NOW);

    const queued = await queueLatelyRescans(db, { ...DEFAULT_SETTINGS, ...WEEKLY }, NOW);

    expect(queued).toBe(2);
    const latest = (await db.queue.toArray()).filter((job) => job.priority === LATELY_RESCAN);
    expect(latest.map((job) => [job.target, job.rank, job.cursor])).toEqual([
      ['2', 1, { stage: 'latest', since: NOW - 10 * DAY - DAY, token: null, added: 0 }],
      ['1', 2, { stage: 'latest', since: NOW - 10 * DAY - DAY, token: null, added: 0 }],
    ]);
  });
});
