import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { BandcampRequest } from '../bandcamp';
import { DigheadDb, getFollowing, saveViewer, setUnfollowed } from '../db';
import { syncFollowing } from './syncFollowing';
import { syncMe, type SyncDeps } from './syncMe';

const FAN = 77;

function rawBand(id: number, position: number) {
  return {
    band_id: id,
    name: `Band ${id}`,
    url_hints: { subdomain: `band${id}`, custom_domain: null },
    image_id: null,
    location: 'Berlin',
    date_followed: '19 Oct 2026 17:18:45 GMT',
    token: `${position}:tok`,
  };
}

function rawFan(id: number, position: number) {
  return {
    fan_id: id,
    name: `Fan ${id}`,
    trackpipe_url: `https://bandcamp.com/fan${id}`,
    image_id: null,
    location: null,
    date_followed: '19 Oct 2026 17:18:45 GMT',
    token: `${position}:tok`,
  };
}

interface Lists {
  band: number[];
  fan: number[];
  /** Number of following requests after which the server starts failing. */
  failAfter?: number;
}

/** Serves following pages from in-memory id lists, honouring `count`. */
function fakeFollowing(lists: Lists) {
  const counts: number[] = [];
  const fetchJson = async ({ url, init }: BandcampRequest) => {
    if (!url.includes('following_')) {
      return { items: [], more_available: false, last_token: null };
    }
    if (lists.failAfter !== undefined && counts.length >= lists.failAfter) {
      throw new Error('network down');
    }
    const kind = url.endsWith('following_bands') ? 'band' : 'fan';
    const body = JSON.parse(init.body as string) as { older_than_token: string; count: number };
    counts.push(body.count);
    const offset = body.older_than_token.endsWith(':tok')
      ? Number.parseInt(body.older_than_token, 10)
      : 0;
    const ids = lists[kind];
    const page = ids.slice(offset, offset + body.count);
    const end = offset + page.length;
    return {
      followeers: page.map((id, i) =>
        kind === 'band' ? rawBand(id, offset + i + 1) : rawFan(id, offset + i + 1),
      ),
      more_available: end < ids.length,
      last_token: null,
    };
  };
  return { fetchJson, counts };
}

let db: DigheadDb;

beforeEach(async () => {
  db = new DigheadDb(`test-${crypto.randomUUID()}`);
  await db.open();
});

afterEach(async () => {
  await db.delete();
});

function deps(fetchJson: SyncDeps['fetchJson'], overrides: Partial<SyncDeps> = {}): SyncDeps {
  return {
    db,
    fetchJson,
    batchSize: 2,
    pause: async () => {},
    now: () => 1000,
    onProgress: () => {},
    onFollowingProgress: () => {},
    ...overrides,
  };
}

describe('syncFollowing', () => {
  it('saves both lists', async () => {
    await syncFollowing(deps(fakeFollowing({ band: [1, 2], fan: [9] }).fetchJson), FAN);

    expect(await getFollowing(db, ['band', 2])).toMatchObject({
      name: 'Band 2',
      url: 'https://band2.bandcamp.com',
      tagIds: [],
    });
    expect(await getFollowing(db, ['fan', 9])).toMatchObject({ name: 'Fan 9' });
  });

  it('keeps tags on rows that are still followed', async () => {
    await syncFollowing(deps(fakeFollowing({ band: [1, 2], fan: [] }).fetchJson), FAN);
    await db.following.update(['band', 1], { tagIds: [5, 6] });

    await syncFollowing(deps(fakeFollowing({ band: [1, 2, 3], fan: [] }).fetchJson), FAN);

    expect((await getFollowing(db, ['band', 1]))?.tagIds).toEqual([5, 6]);
    expect(await getFollowing(db, ['band', 3])).toBeDefined();
  });

  it('deletes rows unfollowed elsewhere, and rows marked unfollowed, with their tags', async () => {
    await syncFollowing(deps(fakeFollowing({ band: [1, 2], fan: [9] }).fetchJson), FAN);
    await db.following.update(['band', 1], { tagIds: [5] });
    await setUnfollowed(db, ['band', 2], true);

    await syncFollowing(deps(fakeFollowing({ band: [2], fan: [9] }).fetchJson), FAN);

    expect(await getFollowing(db, ['band', 1])).toBeUndefined();
    // Bandcamp still lists band 2, so the mark is cleared rather than the row deleted.
    expect((await getFollowing(db, ['band', 2]))?.unfollowed).toBe(false);
    expect(await getFollowing(db, ['fan', 9])).toBeDefined();
  });

  it('pages 500 rows at a time', async () => {
    const band = Array.from({ length: 1200 }, (_, i) => i + 1);
    const bandcamp = fakeFollowing({ band, fan: [] });
    const progress: number[] = [];
    let pauses = 0;

    await syncFollowing(
      deps(bandcamp.fetchJson, {
        pause: async () => void pauses++,
        onFollowingProgress: (n) => progress.push(n),
      }),
      FAN,
    );

    expect(await db.following.count()).toBe(1200);
    expect(bandcamp.counts).toEqual([500, 500, 500, 500]); // three band pages, one empty fan page
    expect(progress).toEqual([500, 1000, 1200, 1200]);
    expect(pauses).toBe(2);
  });

  it('replaces nothing when a list fails part-way', async () => {
    await syncFollowing(deps(fakeFollowing({ band: [1, 2], fan: [9] }).fetchJson), FAN);
    await db.following.update(['band', 1], { tagIds: [5] });

    // Bands succeed, then the fan list fails: the new band list must not be written either.
    const failing = fakeFollowing({ band: [3], fan: [9], failAfter: 1 });
    await expect(syncFollowing(deps(failing.fetchJson), FAN)).rejects.toThrow('network down');

    expect(await db.following.count()).toBe(3);
    expect((await getFollowing(db, ['band', 1]))?.tagIds).toEqual([5]);
    expect(await getFollowing(db, ['band', 3])).toBeUndefined();
  });

  it('replaces nothing when a later band page fails', async () => {
    await syncFollowing(deps(fakeFollowing({ band: [1], fan: [] }).fetchJson), FAN);
    const band = Array.from({ length: 600 }, (_, i) => i + 10);

    const failing = fakeFollowing({ band, fan: [], failAfter: 1 });
    await expect(syncFollowing(deps(failing.fetchJson), FAN)).rejects.toThrow();

    expect(await db.following.count()).toBe(1);
  });
});

describe('syncMe with followings', () => {
  it('keeps the collection sync when the following sync fails', async () => {
    const me = await saveViewer(db, { fanId: FAN, username: 'me' });
    const fetchJson = async ({ url }: BandcampRequest) => {
      if (url.includes('following_')) throw new Error('network down');
      return { items: [], more_available: false, last_token: null };
    };

    await expect(syncMe(deps(fetchJson), me, 'full')).resolves.toEqual([]);
  });
});
