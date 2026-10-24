import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DigheadDb } from '../schema';
import {
  completeJob,
  countJobs,
  enqueue,
  enqueueAt,
  failJob,
  fanJob,
  focusRelease,
  nextJob,
  rankFanJobs,
  saveProgress,
} from './queue';

let db: DigheadDb;

beforeEach(async () => {
  db = new DigheadDb(`test-${crypto.randomUUID()}`);
  await db.open();
});

afterEach(async () => {
  await db.delete();
});

async function order(now = Infinity): Promise<string[]> {
  const targets: string[] = [];
  for (;;) {
    const job = await nextJob(db, now);
    if (!job) return targets;
    targets.push(job.target);
    await completeJob(db, job);
  }
}

const release = (target: `a${number}`) => ({ kind: 'release' as const, target, url: 'u' });

describe('queue', () => {
  it('breaks ties within one place in line by rank, before insertion order', async () => {
    await enqueueAt(
      db,
      [
        { spec: release('a1'), at: 10, rank: 0 },
        { spec: fanJob(1, 'a1'), at: 10, rank: 3 },
        { spec: fanJob(2, 'a1'), at: 10, rank: 1 },
        { spec: fanJob(3, 'a1'), at: 10, rank: 2 },
        { spec: fanJob(4), at: 5, rank: 99 },
      ],
      1,
    );

    expect(await order()).toEqual(['4', 'a1', '2', '3', '1']);
  });

  it('re-ranks only fan jobs that have not started', async () => {
    await enqueueAt(
      db,
      [1, 2, 3].map((fanId) => ({ spec: fanJob(fanId), at: 0, rank: fanId })),
      1,
    );
    const started = await nextJob(db, 0);
    if (!started) throw new Error('expected a job');
    await saveProgress(db, started, { cursor: { stage: 'quick' }, rank: 1 });

    await rankFanJobs(
      db,
      new Map([
        [1, 9],
        [2, 8],
        [3, 0.5],
      ]),
    );

    expect(await order()).toEqual(['3', '1', '2']);
  });

  it('moves a started job to a new rank and priority', async () => {
    await enqueue(db, [fanJob(1), fanJob(2)], 1, 0);
    const first = await nextJob(db, 0);
    if (!first) throw new Error('expected a job');

    await saveProgress(db, first, { cursor: { stage: 'quick' }, rank: 5, priority: 2 });

    expect(await db.queue.get(first.id ?? -1)).toMatchObject({
      rank: 5,
      priority: 2,
      cursor: { stage: 'quick' },
    });
    expect(await order()).toEqual(['2', '1']);
  });

  it('runs jobs by priority, then next attempt time, then insertion order', async () => {
    await enqueue(db, [fanJob(1)], 2, 0);
    await enqueue(db, [fanJob(2)], 1, 50);
    await enqueue(db, [fanJob(3), fanJob(4)], 1, 10);

    expect(await order()).toEqual(['3', '4', '2', '1']);
  });

  it('runs foreground, then background, then seed jobs, each in its own place in line', async () => {
    await enqueueAt(
      db,
      [
        { spec: release('a1'), at: -100 },
        { spec: release('a2'), at: -300 },
      ],
      3,
    );
    await enqueue(db, [release('a3')], 2, 50);
    await enqueue(db, [fanJob(1)], 3, -300);
    await enqueue(db, [release('a4')], 1, 99);

    expect(await order()).toEqual(['a4', 'a3', 'a2', '1', 'a1']);
  });

  it('keeps a background release out of reach of a later focus, and seeds below both', async () => {
    await enqueue(db, [release('a1')], 1, 0);
    await enqueueAt(db, [{ spec: release('a9'), at: -1 }], 3);
    await enqueue(db, [release('a2')], 1, 10);

    await focusRelease(db, 'a2', [], 1, 2);

    expect((await db.queue.toArray()).map((j) => [j.target, j.priority])).toEqual([
      ['a1', 2],
      ['a9', 3],
      ['a2', 1],
    ]);
  });

  it('skips jobs that are not due yet', async () => {
    await enqueue(db, [fanJob(1)], 1, 500);
    await enqueue(db, [fanJob(2)], 2, 100);

    expect(await order(200)).toEqual(['2']);
    expect(await order(500)).toEqual(['1']);
  });

  it('de-duplicates by kind and target, keeping the more urgent priority', async () => {
    await enqueue(db, [fanJob(1), release('a1')], 3, 0);
    const first = await nextJob(db, 0);
    if (!first) throw new Error('expected a job');
    await saveProgress(db, first, { cursor: { stage: 'full', token: 't', scanned: 100 } });

    await enqueue(db, [fanJob(1), fanJob(1)], 1, 99);
    await enqueue(db, [fanJob(1)], 5, 99);

    expect(await countJobs(db)).toEqual({ release: 1, fan: 1, followReleases: 0 });
    expect(await db.queue.toArray()).toContainEqual(
      expect.objectContaining({
        target: '1',
        priority: 1,
        nextAttemptAt: 0,
        cursor: { stage: 'full', token: 't', scanned: 100 },
      }),
    );
  });

  it('reschedules a failed job, or drops it', async () => {
    await enqueue(db, [fanJob(1), fanJob(2)], 1, 0);
    const [one, two] = await db.queue.toArray();
    if (!one || !two) throw new Error('expected two jobs');

    await failJob(db, one, 1000);
    await failJob(db, two, null);

    expect(await db.queue.toArray()).toEqual([
      expect.objectContaining({ target: '1', attempts: 1, nextAttemptAt: 1000 }),
    ]);
  });

  it('moves the focused release and its supporters ahead of an earlier one', async () => {
    await enqueue(db, [release('a1'), fanJob(10), fanJob(11)], 1, 0);
    await enqueue(db, [fanJob(20)], 5, 0);
    await enqueue(db, [release('a2')], 1, 100);

    await focusRelease(db, 'a2', [20], 1, 2);

    expect(await order()).toEqual(['20', 'a2', 'a1', '10', '11']);
  });
});
