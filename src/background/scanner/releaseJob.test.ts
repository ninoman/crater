import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fixtureJson, fixtureText } from '../../../tests/fixtures';
import { ParserError, type BandcampRequest } from '../../bandcamp';
import { DigheadDb, getItem, putFollowing, refreshFanMatches, type ReleaseJob } from '../../db';
import { DEFAULT_SETTINGS } from '../../shared/settings';
import type { StepContext } from './context';
import { runReleaseStep } from './releaseJob';

const NOW = 1_800_000_000_000;
const PROMISES = 'a3149089081';

let db: DigheadDb;
let requests: { kind: string; count: number; token: string }[];

beforeEach(async () => {
  db = new DigheadDb(`test-${crypto.randomUUID()}`);
  await db.open();
  requests = [];
});

afterEach(async () => {
  await db.delete();
});

function context(
  cap: number,
  thumbs = fixtureJson('tralbumcollectors-thumbs-p2.json'),
): StepContext {
  return {
    db,
    now: NOW,
    settings: { ...DEFAULT_SETTINGS, supportersPerReleaseCap: cap },
    fetchText: async () => fixtureText('album-page.html'),
    fetchJson: async ({ url, init }: BandcampRequest) => {
      const body = JSON.parse(init.body as string) as { count: number; token: string };
      const kind = url.endsWith('/thumbs') ? 'thumbs' : 'reviews';
      requests.push({ kind, count: body.count, token: body.token });
      return kind === 'thumbs' ? thumbs : fixtureJson('tralbumcollectors-reviews-p2.json');
    },
  };
}

function job(cursor: ReleaseJob['cursor'] = null): ReleaseJob {
  return {
    id: 1,
    kind: 'release',
    target: PROMISES,
    url: 'https://floatingpoints.bandcamp.com/album/promises',
    priority: 1,
    rank: 0,
    attempts: 0,
    nextAttemptAt: 0,
    cursor,
  };
}

describe('runReleaseStep', () => {
  it('saves the first page, then pages thumbs up to the cap', async () => {
    const ctx = context(150);

    const cursor = await runReleaseStep(ctx, job());
    expect(cursor).toEqual({
      thumbsToken: expect.stringMatching(/^1:\d+:\d+:0:1:0$/),
      reviewsToken: expect.stringMatching(/^1:\d+:\d+:1:1:0$/),
      collected: 86,
    });
    expect((await getItem(db, PROMISES))?.tags.length).toBeGreaterThan(0);

    expect(await runReleaseStep(ctx, job(cursor))).toBeNull();
    expect(requests).toEqual([{ kind: 'thumbs', count: 64, token: cursor?.thumbsToken }]);

    const supporters = await db.releaseSupporters.get(PROMISES);
    expect(supporters?.fanIds).toHaveLength(150);
    expect(supporters?.fetchedAt).toBe(NOW);
    expect(await db.fans.count()).toBe(150);
    expect(await db.ownership.where('matchKey').equals(PROMISES).count()).toBe(150);
    const queued = await db.queue.toArray();
    expect(queued).toHaveLength(150);
    expect(queued.every((q) => q.kind === 'fan' && q.priority === 1)).toBe(true);
  });

  it('moves on to reviewers once thumbs run out', async () => {
    const thumbs = {
      ...(fixtureJson('tralbumcollectors-thumbs-p2.json') as object),
      more_available: false,
    };
    const ctx = context(500, thumbs);

    let cursor = await runReleaseStep(ctx, job());
    cursor = await runReleaseStep(ctx, job(cursor));
    expect(cursor).toMatchObject({ thumbsToken: null, collected: 186 });

    cursor = await runReleaseStep(ctx, job(cursor));
    expect(requests.map((r) => r.kind)).toEqual(['thumbs', 'reviews']);
    expect(cursor).toMatchObject({ thumbsToken: null, collected: 206 });
    expect(cursor?.reviewsToken).toMatch(/:1:1:0$/);
  });

  it("doesn't queue fans scanned in the last 30 days", async () => {
    const ctx = context(86);
    await runReleaseStep(ctx, job());
    const [first] = (await db.releaseSupporters.get(PROMISES))?.fanIds ?? [];
    await db.fans.update(first as number, { collectionFetchedAt: NOW - 1000, status: 'done' });
    await db.queue.clear();

    expect(await runReleaseStep(ctx, job())).toBeNull(); // the cap is reached on the first page
    expect(await db.queue.count()).toBe(85);
    expect((await db.fans.get(first as number))?.status).toBe('done');
  });

  it("queues fans at the release job's priority and place in line", async () => {
    await runReleaseStep(context(86), { ...job(), priority: 3, nextAttemptAt: -500 });

    const queued = await db.queue.toArray();
    expect(queued).toHaveLength(86);
    expect(queued.every((q) => q.priority === 3 && q.nextAttemptAt === -500)).toBe(true);
  });

  it('keeps page order, then ranks supporters by what they own of yours once the list is in', async () => {
    const ctx = context(86);
    await runReleaseStep(ctx, job());
    const fanIds = (await db.releaseSupporters.get(PROMISES))?.fanIds ?? [];
    const order = async () =>
      (await db.queue.orderBy('[priority+nextAttemptAt+rank]').toArray()).map((q) =>
        Number(q.target),
      );
    expect(await order()).toEqual(fanIds);
    expect((await db.queue.toArray()).every((q) => q.kind === 'fan' && q.via === PROMISES)).toBe(
      true,
    );

    const keen = fanIds[40] as number;
    await db.me.put({ id: 'self', fanId: 1, username: 'me', syncedAt: NOW });
    await db.ownership.bulkPut(
      [1, keen].map((fanId) => ({
        fanId,
        itemKey: 'a5' as const,
        matchKey: 'a5' as const,
        source: 'collection' as const,
        addedAt: null,
      })),
    );
    await refreshFanMatches(db, [1, keen]);
    await db.queue.clear();
    await runReleaseStep(ctx, job());

    expect(await order()).toEqual([keen, ...fanIds.filter((id) => id !== keen)]);
  });

  it('reads supporters you follow first, ahead of the best expected overlap', async () => {
    const ctx = context(86);
    await runReleaseStep(ctx, job());
    const fanIds = (await db.releaseSupporters.get(PROMISES))?.fanIds ?? [];
    const keen = fanIds[40] as number;
    const friend = fanIds[60] as number;
    await db.me.put({ id: 'self', fanId: 1, username: 'me', syncedAt: NOW });
    await db.ownership.bulkPut(
      [1, keen].map((fanId) => ({
        fanId,
        itemKey: 'a5' as const,
        matchKey: 'a5' as const,
        source: 'collection' as const,
        addedAt: null,
      })),
    );
    await refreshFanMatches(db, [1, keen]);
    await putFollowing(db, [
      {
        kind: 'fan',
        id: friend,
        name: 'Friend',
        url: '',
        imageId: null,
        location: null,
        followedAt: 0,
      },
    ]);
    await db.queue.clear();
    await runReleaseStep(ctx, job());

    const order = (await db.queue.orderBy('[priority+nextAttemptAt+rank]').toArray()).map((q) =>
      Number(q.target),
    );
    expect(order.slice(0, 2)).toEqual([friend, keen]);
  });

  it('refuses a page that is a different release than the job asked for', async () => {
    await expect(runReleaseStep(context(500), { ...job(), target: 'a1' })).rejects.toThrow(
      ParserError,
    );
  });
});
