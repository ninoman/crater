import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DigheadDb, enqueueLatestReads, type FanRecord } from '../../db';
import { DEFAULT_SETTINGS } from '../../shared/settings';
import { fetchJson, fetchText } from '../http';
import { LATELY_RESCAN } from './priority';
import { drainQueue } from './scheduler';
import { INITIAL_SCANNER_STATE, type ScannerState, type ScannerStore } from './state';

const DAY = 24 * 60 * 60 * 1000;
const START = new Date(2026, 9, 20, 12, 0, 0).getTime();
const FAN = 42;

/** A fan who bought one album a day, the newest `daysAgo` 0, `owned` of them in all. */
function fakeCollection(owned: number, reply: 'ok' | 'error' = 'ok') {
  const requests: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init: RequestInit = {}) => {
      const body = JSON.parse(init.body as string) as { older_than_token: string; count: number };
      requests.push(body.older_than_token);
      if (reply === 'error') return Response.json({ error: true });
      const offset = body.older_than_token.startsWith('p:')
        ? Number(body.older_than_token.slice(2))
        : 0;
      const end = Math.min(owned, offset + body.count);
      const items = [];
      for (let day = offset; day < end; day++) {
        items.push({
          token: `p:${day}`,
          item_type: 'album',
          tralbum_id: 1000 + day,
          tralbum_type: 'a',
          album_id: null,
          item_title: `Album ${day}`,
          band_id: 1,
          band_name: 'Artist',
          also_collected_count: 3,
          item_art_id: null,
          item_url: `https://artist.bandcamp.com/album/${day}`,
          purchased: new Date(START - day * DAY).toUTCString(),
        });
      }
      return Response.json({ items, more_available: end < owned, last_token: `p:${end}` });
    }),
  );
  return requests;
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

let db: DigheadDb;

async function drain(collectionBatchSize: number) {
  return drainQueue({
    db,
    fetchJson,
    fetchText,
    store: memoryStore(),
    loadSettings: async () => ({ ...DEFAULT_SETTINGS, collectionBatchSize }),
    now: Date.now,
    sleep: async (ms) => void vi.setSystemTime(Date.now() + ms),
    random: () => 0.5,
    owner: 'worker-1',
    waitForOwnSync: async () => {},
    onStep: async () => {},
  });
}

async function fanReadDaysAgo(days: number, owned: number) {
  const fan: FanRecord = {
    fanId: FAN,
    username: 'twin',
    name: 'Twin',
    imageId: null,
    collectionSize: owned,
    scannedItems: owned,
    collectionFetchedAt: START - days * DAY,
    status: 'done',
    lastSeenAt: START - days * DAY,
  };
  await db.fans.put(fan);
  // What the last read saw: everything bought before it.
  await db.ownership.bulkPut(
    Array.from({ length: owned }, (_, i) => ({
      fanId: FAN,
      itemKey: `a${1000 + days + i}` as const,
      matchKey: `a${1000 + days + i}` as const,
      source: 'collection' as const,
      addedAt: START - (days + i) * DAY,
    })),
  );
  await enqueueLatestReads(
    db,
    [{ fanId: FAN, since: START - (days + 1) * DAY }],
    LATELY_RESCAN,
    START,
  );
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

describe('latest reads', () => {
  it('reads one page from the top, adds what is new and stops at what the last read saw', async () => {
    const requests = fakeCollection(300);
    await fanReadDaysAgo(7, 293);

    expect(await drain(100)).toBe('idle');

    expect(requests).toEqual([expect.stringMatching(/::a::$/)]);
    const fan = await db.fans.get(FAN);
    expect(fan).toMatchObject({ status: 'done', scannedItems: 300, collectionSize: 300 });
    expect(fan?.collectionFetchedAt).toBe(Date.now());
    expect(await db.ownership.where('fanId').equals(FAN).count()).toBe(300);
    expect(await db.queue.count()).toBe(0);
  });

  it('keeps paging while every purchase on the page is new', async () => {
    const requests = fakeCollection(300);
    await fanReadDaysAgo(25, 275);

    await drain(10);

    expect(requests).toHaveLength(3);
    expect((await db.fans.get(FAN))?.scannedItems).toBe(300);
  });

  it('keeps the collection on file when Bandcamp refuses the page', async () => {
    fakeCollection(300, 'error');
    await fanReadDaysAgo(7, 293);

    await drain(100);

    expect(await db.fans.get(FAN)).toMatchObject({ status: 'done', scannedItems: 293 });
    expect(await db.ownership.where('fanId').equals(FAN).count()).toBe(293);
  });
});
