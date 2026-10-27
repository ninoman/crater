import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CraterDb, enqueue, getQueuedJob } from '../../db';
import { SUPPORTERS_FRESH_MS } from './freshness';
import { BACKGROUND, SEED } from './priority';
import { queueRelease } from './queueRelease';

const NOW = 1_800_000_000_000;
const URL = 'https://artist.bandcamp.com/album/a1';

let db: CraterDb;

beforeEach(async () => {
  db = new CraterDb(`test-${crypto.randomUUID()}`);
  await db.open();
});

afterEach(async () => {
  await db.delete();
});

describe('queueRelease', () => {
  it('queues a new release at background priority', async () => {
    expect(await queueRelease(db, 'a1', URL, NOW)).toBe('queued');

    expect(await getQueuedJob(db, 'release', 'a1')).toMatchObject({
      url: URL,
      priority: BACKGROUND,
    });
  });

  it('reports a release already in the queue, moving it up but not duplicating it', async () => {
    await enqueue(db, [{ kind: 'release', target: 'a1', url: URL }], SEED, NOW);

    expect(await queueRelease(db, 'a1', URL, NOW)).toBe('already-queued');

    expect(await db.queue.count()).toBe(1);
    expect(await getQueuedJob(db, 'release', 'a1')).toMatchObject({ priority: BACKGROUND });
  });

  it('skips a release whose supporters were read within 7 days', async () => {
    await db.releaseSupporters.put({ itemKey: 'a1', fanIds: [], fetchedAt: NOW - 1000 });

    expect(await queueRelease(db, 'a1', URL, NOW)).toBe('fresh');
    expect(await db.queue.count()).toBe(0);
  });

  it('queues again once the supporter list is a week old', async () => {
    await db.releaseSupporters.put({
      itemKey: 'a1',
      fanIds: [],
      fetchedAt: NOW - SUPPORTERS_FRESH_MS,
    });

    expect(await queueRelease(db, 'a1', URL, NOW)).toBe('queued');
  });
});
