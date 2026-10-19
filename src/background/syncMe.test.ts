import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { BandcampRequest } from '../bandcamp';
import { countOwnership, DigheadDb, getMe, ownedItemKeys, saveViewer, type MeRecord } from '../db';
import { syncMe, type SyncDeps } from './syncMe';

const FAN = 77;

function rawAlbum(id: number, position: number) {
  return {
    token: `at:${position}`,
    item_type: 'album',
    tralbum_id: id,
    tralbum_type: 'a',
    album_id: null,
    item_title: `Album ${id}`,
    band_id: 1,
    band_name: 'Artist',
    also_collected_count: 3,
    item_art_id: null,
    item_url: `https://artist.bandcamp.com/album/${id}`,
    purchased: '19 Oct 2026 17:18:45 GMT',
  };
}

/** Serves collection and wishlist pages from in-memory lists, newest first. */
function fakeBandcamp(lists: { collection: number[]; wishlist: number[] | 'hidden' }) {
  const requests: string[] = [];
  const fetchJson = async ({ url, init }: BandcampRequest) => {
    const list = url.endsWith('wishlist_items') ? 'wishlist' : 'collection';
    const body = JSON.parse(init.body as string) as { older_than_token: string; count: number };
    const token = body.older_than_token.startsWith('at:') ? body.older_than_token : 'start';
    requests.push(`${list}:${token}`);
    const ids = lists[list];
    if (ids === 'hidden') return { error: true };
    const offset = token === 'start' ? 0 : Number(token.slice(3));
    const page = ids.slice(offset, offset + body.count);
    const end = offset + page.length;
    return {
      items: page.map((id, i) => rawAlbum(id, offset + i + 1)),
      more_available: end < ids.length,
      // Like Bandcamp, last_token lags behind the end of a page (it points at item 20).
      last_token: page.length ? `at:${offset + 1}` : null,
    };
  };
  return { fetchJson, requests };
}

let db: DigheadDb;
let me: MeRecord;

beforeEach(async () => {
  db = new DigheadDb(`test-${crypto.randomUUID()}`);
  await db.open();
  me = await saveViewer(db, { fanId: FAN, username: 'me' });
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
    ...overrides,
  };
}

describe('syncMe', () => {
  it('pulls the full collection and wishlist and marks the sync time', async () => {
    const bandcamp = fakeBandcamp({ collection: [1, 2, 3, 4, 5], wishlist: [10, 11] });
    let pauses = 0;
    const progress: number[] = [];

    await syncMe(
      deps(bandcamp.fetchJson, {
        pause: async () => void pauses++,
        onProgress: (n) => progress.push(n),
      }),
      me,
      'full',
    );

    expect(await countOwnership(db, FAN, 'collection')).toBe(5);
    expect(await countOwnership(db, FAN, 'wishlist')).toBe(2);
    expect((await db.items.get('a3'))?.supporterCount).toBe(4);
    expect((await getMe(db))?.syncedAt).toBe(1000);
    expect(pauses).toBe(2); // between the three collection pages
    expect(progress).toEqual([2, 4, 6, 7]);
  });

  it('stops an incremental sync at the first page of known items', async () => {
    await syncMe(
      deps(fakeBandcamp({ collection: [1, 2, 3, 4, 5, 6], wishlist: [] }).fetchJson),
      me,
      'full',
    );
    const bandcamp = fakeBandcamp({ collection: [9, 1, 2, 3, 4, 5, 6], wishlist: [] });

    await syncMe(deps(bandcamp.fetchJson), me, 'incremental');

    expect(await ownedItemKeys(db, FAN, 'collection')).toContain('a9');
    expect(bandcamp.requests).toEqual(['wishlist:start', 'collection:start', 'collection:at:2']);
  });

  it('drops wishlist items that were removed, on a full sync', async () => {
    await syncMe(deps(fakeBandcamp({ collection: [], wishlist: [10, 11] }).fetchJson), me, 'full');

    await syncMe(deps(fakeBandcamp({ collection: [], wishlist: [11] }).fetchJson), me, 'full');

    expect(await ownedItemKeys(db, FAN, 'wishlist')).toEqual(new Set(['a11']));
  });

  it('moves a bought wishlist item to the collection', async () => {
    await syncMe(deps(fakeBandcamp({ collection: [], wishlist: [10] }).fetchJson), me, 'full');

    await syncMe(deps(fakeBandcamp({ collection: [10], wishlist: [10] }).fetchJson), me, 'full');

    expect((await db.ownership.get([FAN, 'a10']))?.source).toBe('collection');
  });

  it('still syncs the collection when the wishlist is hidden', async () => {
    await syncMe(
      deps(fakeBandcamp({ collection: [1, 2], wishlist: 'hidden' }).fetchJson),
      me,
      'full',
    );

    expect(await countOwnership(db, FAN, 'collection')).toBe(2);
    expect((await getMe(db))?.syncedAt).toBe(1000);
  });

  it('fails without marking a sync when the collection errors', async () => {
    const failing = async () => ({ error: true });

    await expect(syncMe(deps(failing), me, 'full')).rejects.toThrow();
    expect((await getMe(db))?.syncedAt).toBeNull();
  });
});
