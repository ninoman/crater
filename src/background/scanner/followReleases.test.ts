import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fixtureJson } from '../../../tests/fixtures';
import { DigheadDb, enqueue, getBandRelease, saveDiscography } from '../../db';
import type { FollowingRecord } from '../../db';
import { DEFAULT_SETTINGS } from '../../shared/settings';
import { fetchJson, fetchText } from '../http';
import { bandsDueForRead, FOLLOW_READ_DAYS, queueFollowReads } from './followReleases';
import { BACKGROUND, FOLLOW_RELEASES } from './priority';
import { drainQueue } from './scheduler';
import { INITIAL_SCANNER_STATE, type ScannerState, type ScannerStore } from './state';

const DAY = 24 * 60 * 60 * 1000;
const START = Date.UTC(2026, 9, 20, 12);
const ARTIST = 2009518365;

function following(id: number, patch: Partial<FollowingRecord> = {}): FollowingRecord {
  return {
    kind: 'band',
    id,
    name: `Band ${id}`,
    url: `https://band${id}.bandcamp.com`,
    imageId: null,
    location: null,
    followedAt: 0,
    tagIds: [],
    unfollowed: false,
    ...patch,
  };
}

function memoryStore(): ScannerStore {
  let state: ScannerState = { ...INITIAL_SCANNER_STATE };
  return {
    load: async () => state,
    save: async (patch) => {
      state = { ...state, ...patch };
      return state;
    },
  };
}

/** Serves the artist fixture, plus `extra` releases at the top, and details for any release. */
function fakeBandcamp(extra: object[] = [], missing: ReadonlySet<number> = new Set()) {
  const requests: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const body = JSON.parse(init.body as string) as { band_id: number; tralbum_id?: number };
      requests.push(url.endsWith('band_details') ? 'band' : `details ${body.tralbum_id}`);
      expect(init.credentials).toBe('omit');
      if (url.endsWith('band_details')) {
        const band = fixtureJson('band_details.json') as { discography: object[] };
        return Response.json({ ...band, discography: [...extra, ...band.discography] });
      }
      if (missing.has(body.tralbum_id ?? 0)) return Response.json({ error: true });
      return Response.json({
        id: body.tralbum_id,
        type: 'a',
        bandcamp_url: `https://floatingpoints.bandcamp.com/album/${body.tralbum_id}`,
        album_id: body.tralbum_id,
        release_date: null,
        is_preorder: false,
      });
    }),
  );
  return requests;
}

let db: DigheadDb;

function drain() {
  return drainQueue({
    db,
    fetchJson,
    fetchText,
    store: memoryStore(),
    loadSettings: async () => DEFAULT_SETTINGS,
    now: Date.now,
    sleep: async (ms) => void vi.setSystemTime(Date.now() + ms),
    random: () => 0.5,
    owner: 'worker-1',
    waitForOwnSync: async () => {},
    onStep: async () => {},
  });
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(START);
  db = new DigheadDb(`test-${crypto.randomUUID()}`);
  await db.open();
});

afterEach(async () => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  await db.delete();
});

describe('bandsDueForRead', () => {
  it('reads never-read bands first, then the longest unread, and skips queued or fresh ones', () => {
    const readAt = new Map([
      [1, START - 8 * DAY],
      [2, START - 30 * DAY],
      [3, START - DAY],
    ]);
    expect(bandsDueForRead([1, 2, 3, 4, 5, 6], readAt, new Set([5]), START)).toEqual([4, 6, 2, 1]);
    expect(
      bandsDueForRead([1], new Map([[1, START - FOLLOW_READ_DAYS * DAY]]), new Set(), START),
    ).toEqual([1]);
  });
});

describe('queueFollowReads', () => {
  it('queues followed bands, skips unfollowed ones and forgets bands no longer followed', async () => {
    await db.following.bulkPut([
      following(1),
      following(2, { unfollowed: true }),
      { ...following(3), kind: 'fan' },
    ]);
    await saveDiscography(db, { bandId: 9, name: 'Gone', releases: [] }, START - DAY);
    expect(await queueFollowReads(db, FOLLOW_RELEASES, START)).toBe(1);
    const jobs = await db.queue.toArray();
    expect(jobs.map((job) => [job.kind, job.target, job.priority])).toEqual([
      ['followReleases', '1', FOLLOW_RELEASES],
    ]);
    expect(await db.bandReads.count()).toBe(0);
  });

  it('raises reads already waiting when the tab opens', async () => {
    await db.following.bulkPut([following(1), following(2)]);
    await queueFollowReads(db, FOLLOW_RELEASES, START);
    await enqueue(
      db,
      [{ kind: 'release', target: 'a1', url: 'https://x.bandcamp.com/album/y' }],
      3,
      START,
    );
    expect(await queueFollowReads(db, BACKGROUND, START)).toBe(0);
    const priorities = (await db.queue.toArray()).map((job) => [job.kind, job.priority]);
    expect(priorities).toEqual([
      ['followReleases', BACKGROUND],
      ['followReleases', BACKGROUND],
      ['release', 3],
    ]);
  });
});

describe('a followReleases job', () => {
  it("reads the band, then the URL of each release in the digest's window", async () => {
    const requests = fakeBandcamp();
    await enqueue(db, [{ kind: 'followReleases', target: `${ARTIST}` }], FOLLOW_RELEASES, START);
    expect(await drain()).toBe('idle');
    // Only Mere Mortals (28 Aug) is within 60 days of 20 Oct.
    expect(requests).toEqual(['band', 'details 533227808']);
    expect(await getBandRelease(db, ARTIST, 'a533227808')).toMatchObject({
      baseline: true,
      url: 'https://floatingpoints.bandcamp.com/album/533227808',
    });
    expect(await getBandRelease(db, ARTIST, 'a2139996679')).toMatchObject({ url: null });
  });

  it('finds a release added since the last read as news, and skips one taken down', async () => {
    fakeBandcamp();
    await enqueue(db, [{ kind: 'followReleases', target: `${ARTIST}` }], FOLLOW_RELEASES, START);
    await drain();

    vi.setSystemTime(START + 7 * DAY);
    const fresh = (id: number) => ({
      item_id: id,
      item_type: 'album',
      artist_name: null,
      band_name: 'Floating Points',
      band_id: ARTIST,
      title: `New ${id}`,
      art_id: 1,
      release_date: new Date(START + 6 * DAY).toUTCString(),
    });
    const requests = fakeBandcamp([fresh(1), fresh(2)], new Set([1]));
    await enqueue(
      db,
      [{ kind: 'followReleases', target: `${ARTIST}` }],
      FOLLOW_RELEASES,
      Date.now(),
    );
    expect(await drain()).toBe('idle');
    expect(requests).toEqual(['band', 'details 1', 'details 2']);
    expect(await getBandRelease(db, ARTIST, 'a2')).toMatchObject({
      baseline: false,
      firstSeenAt: expect.any(Number),
      url: 'https://floatingpoints.bandcamp.com/album/2',
    });
    expect(await getBandRelease(db, ARTIST, 'a1')).toMatchObject({ url: null });
  });
});
