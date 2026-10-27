import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DiscographyRelease, ItemKey } from '../../bandcamp';
import { CraterDb } from '../schema';
import {
  bandCatalogues,
  bandReadTimes,
  forgetBandReleases,
  getBandRelease,
  mutedBandIds,
  recentBandReleases,
  saveDiscography,
  saveReleaseDetails,
  setFollowMute,
} from './bandReleases';
import { clearAllData } from './clear';
import { countJobs, enqueue, raiseJobs } from './queue';

const DAY = 24 * 60 * 60 * 1000;

function release(itemKey: ItemKey, releasedAt: number | null = null): DiscographyRelease {
  return { itemKey, sellerId: 7, title: `T ${itemKey}`, artist: 'A', artId: 1, releasedAt };
}

let db: CraterDb;
beforeEach(async () => {
  db = new CraterDb(`band-releases-${Math.random()}`);
  await db.open();
});
afterEach(async () => {
  db.close();
  await db.delete();
});

describe('saveDiscography', () => {
  it("marks a band's first read as back catalogue and later finds as new", async () => {
    await saveDiscography(db, { bandId: 7, name: 'B', releases: [release('a1')] }, 1000);
    const rows = await saveDiscography(
      db,
      { bandId: 7, name: 'B', releases: [release('a2'), release('a1')] },
      2000,
    );
    expect(rows.map((row) => [row.itemKey, row.baseline, row.firstSeenAt])).toEqual([
      ['a2', false, 2000],
      ['a1', true, 1000],
    ]);
    expect(await bandReadTimes(db)).toEqual(new Map([[7, 2000]]));
  });

  it('keeps details across reads and drops releases no longer listed', async () => {
    await saveDiscography(
      db,
      { bandId: 7, name: 'B', releases: [release('a1'), release('t2')] },
      1,
    );
    await saveReleaseDetails(db, 7, {
      itemKey: 'a1',
      albumKey: null,
      url: 'https://b.bandcamp.com/album/one',
      releasedAt: 50,
      preorder: true,
    });
    await saveDiscography(db, { bandId: 7, name: 'B', releases: [release('a1', 60)] }, 2);
    expect(await getBandRelease(db, 7, 'a1')).toMatchObject({
      url: 'https://b.bandcamp.com/album/one',
      releasedAt: 60,
      preorder: true,
    });
    expect(await getBandRelease(db, 7, 't2')).toBeUndefined();
  });

  it('keeps one row per followed account for a release both list', async () => {
    await saveDiscography(db, { bandId: 7, name: 'Artist', releases: [release('a1')] }, 1);
    await saveDiscography(db, { bandId: 8, name: 'Label', releases: [release('a1')] }, 1);
    expect(await bandCatalogues(db, [7, 8])).toEqual(
      new Map([
        [7, ['a1']],
        [8, ['a1']],
      ]),
    );
  });
});

describe('recentBandReleases', () => {
  it('finds releases recent by date or newly listed, once each', async () => {
    const now = 100 * DAY;
    await saveDiscography(
      db,
      {
        bandId: 7,
        name: 'B',
        releases: [release('a1', now - DAY), release('a2', now - 90 * DAY)],
      },
      now - 80 * DAY,
    );
    await saveDiscography(
      db,
      {
        bandId: 7,
        name: 'B',
        releases: [release('a3', now - 70 * DAY), release('a1', now - DAY), release('a2')],
      },
      now,
    );
    const keys = (await recentBandReleases(db, now - 10 * DAY)).map((row) => row.itemKey);
    expect(keys.sort()).toEqual(['a1', 'a3']);
  });
});

describe('forgetting and muting', () => {
  it("forgets an unfollowed band's releases and read, but keeps its mute", async () => {
    await saveDiscography(db, { bandId: 7, name: 'B', releases: [release('a1')] }, 1);
    await setFollowMute(db, 7, true, 1);
    await forgetBandReleases(db, [7]);
    expect(await bandReadTimes(db)).toEqual(new Map());
    expect(await getBandRelease(db, 7, 'a1')).toBeUndefined();
    expect(await mutedBandIds(db)).toEqual(new Set([7]));
    await setFollowMute(db, 7, false, 2);
    expect(await mutedBandIds(db)).toEqual(new Set());
  });

  it('is emptied by clearing all data', async () => {
    await saveDiscography(db, { bandId: 7, name: 'B', releases: [release('a1')] }, 1);
    await setFollowMute(db, 7, true, 1);
    await clearAllData(db);
    expect(await db.bandReleases.count()).toBe(0);
    expect(await db.bandReads.count()).toBe(0);
    expect(await db.followMutes.count()).toBe(0);
  });
});

describe('follow release jobs in the queue', () => {
  it('are counted and raised as a kind', async () => {
    await enqueue(db, [{ kind: 'followReleases', target: '7' }], 3, 0);
    await enqueue(db, [{ kind: 'release', target: 'a1', url: 'https://x.bandcamp.com' }], 3, 0);
    expect(await countJobs(db)).toEqual({ release: 1, fan: 0, followReleases: 1 });
    await raiseJobs(db, 'followReleases', 2);
    const jobs = await db.queue.toArray();
    expect(jobs.map((job) => [job.kind, job.priority])).toEqual([
      ['followReleases', 2],
      ['release', 3],
    ]);
  });
});
