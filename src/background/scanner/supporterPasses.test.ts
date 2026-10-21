import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ItemKey } from '../../bandcamp';
import { DigheadDb, enqueueAt, fanJob, refreshFanMatches } from '../../db';
import { DEFAULT_SETTINGS, type Settings } from '../../shared/settings';
import { fetchJson, fetchText } from '../http';
import { FOREGROUND, SEED } from './priority';
import { drainQueue, type SchedulerDeps } from './scheduler';
import { INITIAL_SCANNER_STATE, type ScannerState, type ScannerStore } from './state';

// Passes 1 and 2 of supporter scanning (decisions §12), end to end on a fake bandcamp.com.

const START = new Date(2026, 9, 21, 12, 0, 0).getTime();
const RELEASE: ItemKey = 'a900';
const ME = 1;

interface FakeFan {
  /** Bandcamp's in-common count; null renders the page logged out. */
  inCommon: number | null;
  items: number;
  /** HTTP status for the profile page instead of the page, or a header we can't read. */
  profile?: number | 'unreadable';
}

function profileHtml(fanId: number, fan: FakeFan): string {
  const pagedata = {
    fan_data: { fan_id: fanId, username: `fan${fanId}`, is_own_page: false, fav_genre: 'Rock' },
    collection_data: { item_count: fan.items },
    identities: { fan: fan.inCommon === null ? null : { id: ME, username: 'me' } },
  };
  const line =
    fan.profile === 'unreadable'
      ? 'Rock, 8 artículos en común'
      : fan.inCommon
        ? `Rock, ${fan.inCommon} items in common`
        : 'Rock';
  const blob = JSON.stringify(pagedata).replace(/"/g, '&quot;');
  return `<div id="pagedata" data-blob="${blob}"></div>
    <ol class="info-items" ><li class="genre-wrapper">${line}</li></ol>`;
}

function rawAlbum(fanId: number, position: number) {
  const id = fanId * 10_000 + position;
  return {
    token: `p:${fanId}:${position}`,
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

/** Fans own N albums, newest first. Requests are logged as `profile <id>` and `fan <id> <token>`. */
function fakeBandcamp(fans: Record<number, FakeFan>) {
  const requests: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const profile = url.match(/^https:\/\/bandcamp\.com\/fan(\d+)$/);
      if (profile) {
        const fanId = Number(profile[1]);
        const fan = fans[fanId];
        requests.push(`profile ${fanId}`);
        if (!fan) return new Response('', { status: 404 });
        if (typeof fan.profile === 'number') return new Response('', { status: fan.profile });
        return new Response(profileHtml(fanId, fan));
      }
      const body = JSON.parse(init.body as string) as {
        fan_id: number;
        older_than_token: string;
        count: number;
      };
      requests.push(`fan ${body.fan_id} ${body.older_than_token}`);
      const total = fans[body.fan_id]?.items ?? 0;
      const offset = body.older_than_token.startsWith('p:')
        ? Number(body.older_than_token.split(':')[2])
        : 0;
      const end = Math.min(total, offset + body.count);
      const items = [];
      for (let i = offset + 1; i <= end; i++) items.push(rawAlbum(body.fan_id, i));
      return Response.json({ items, more_available: end < total, last_token: null });
    }),
  );
  return requests;
}

function memoryStore(): ScannerStore & { state: ScannerState } {
  return {
    state: { ...INITIAL_SCANNER_STATE },
    async load() {
      return this.state;
    },
    async save(patch) {
      this.state = { ...this.state, ...patch };
      return this.state;
    },
  };
}

let db: DigheadDb;
let store: ReturnType<typeof memoryStore>;
let settings: Settings;

function deps(): SchedulerDeps {
  return {
    db,
    fetchJson,
    fetchText,
    store,
    loadSettings: async () => settings,
    now: Date.now,
    sleep: async (ms) => void vi.setSystemTime(Date.now() + ms),
    random: () => 0.5,
    owner: 'worker-1',
    waitForOwnSync: async () => {},
    onStep: async () => {},
  };
}

/** You, signed in, owning one release, so in-common ratios have a "yours". */
async function signIn() {
  await db.me.put({ id: 'self', fanId: ME, username: 'me', syncedAt: START });
  await db.ownership.put({
    fanId: ME,
    itemKey: 'a1',
    matchKey: 'a1',
    source: 'collection',
    addedAt: null,
  });
  await refreshFanMatches(db, [ME]);
}

/** Lists the fans as the release's supporters and queues them in page order. */
async function listSupporters(fanIds: number[], priority: number = FOREGROUND) {
  await db.fans.bulkPut(
    fanIds.map((fanId) => ({
      fanId,
      username: `fan${fanId}`,
      name: `Fan ${fanId}`,
      imageId: null,
      collectionSize: null,
      scannedItems: 0,
      collectionFetchedAt: null,
      status: 'queued' as const,
      lastSeenAt: START,
    })),
  );
  await db.releaseSupporters.put({ itemKey: RELEASE, fanIds, fetchedAt: START });
  await enqueueAt(
    db,
    fanIds.map((fanId, i) => ({ spec: fanJob(fanId, RELEASE), at: START, rank: i + 1 })),
    priority,
  );
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(START);
  db = new DigheadDb(`test-${crypto.randomUUID()}`);
  await db.open();
  store = memoryStore();
  settings = { ...DEFAULT_SETTINGS, collectionBatchSize: 100, collectionCap: 2000 };
});

afterEach(async () => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  await db.delete();
});

describe('pass 1: profile pages', () => {
  it('reads high-overlap fans right after their profile, and the rest after every profile', async () => {
    await signIn();
    const requests = fakeBandcamp({
      11: { inCommon: 0, items: 50 },
      12: { inCommon: 30, items: 50 },
      13: { inCommon: 5, items: 50 },
    });
    await listSupporters([11, 12, 13]);

    expect(await drainQueue(deps())).toBe('idle');

    expect(requests.map((r) => r.split(' ').slice(0, 2).join(' '))).toEqual([
      'profile 11',
      'profile 12',
      'fan 12',
      'profile 13',
      'fan 13',
      'fan 11',
    ]);
    expect(await db.fans.get(12)).toMatchObject({ itemCount: 50, inCommon: 30, status: 'done' });
  });

  it('keeps pass-0 order when the profile comes back logged out', async () => {
    await signIn();
    const requests = fakeBandcamp({
      11: { inCommon: null, items: 5 },
      12: { inCommon: null, items: 5 },
    });
    await listSupporters([11, 12]);

    await drainQueue(deps());

    expect(requests.map((r) => r.split(' ').slice(0, 2).join(' '))).toEqual([
      'profile 11',
      'fan 11',
      'profile 12',
      'fan 12',
    ]);
    expect((await db.fans.get(11))?.inCommon).toBeNull();
  });

  it('skips profiles logged out and for seed scans', async () => {
    const requests = fakeBandcamp({ 11: { inCommon: 3, items: 5 } });
    await listSupporters([11]);
    await drainQueue(deps());
    expect(requests).toEqual([expect.stringMatching(/^fan 11 /)]);

    await signIn();
    const seed = fakeBandcamp({ 21: { inCommon: 3, items: 5 } });
    await listSupporters([21], SEED);
    await drainQueue(deps());
    expect(seed).toEqual([expect.stringMatching(/^fan 21 /)]);
  });

  it('carries on without a profile that is gone or unreadable, flagging the parser', async () => {
    await signIn();
    const requests = fakeBandcamp({
      11: { inCommon: 3, items: 5, profile: 404 },
      12: { inCommon: 3, items: 5, profile: 'unreadable' },
    });
    await listSupporters([11, 12]);

    expect(await drainQueue(deps())).toBe('idle');

    expect(requests.map((r) => r.split(' ').slice(0, 2).join(' '))).toEqual([
      'profile 11',
      'fan 11',
      'profile 12',
      'fan 12',
    ]);
    expect((await db.fans.bulkGet([11, 12])).map((fan) => fan?.status)).toEqual(['done', 'done']);
    expect(store.state.parserError).toEqual({
      kind: 'profile',
      message: expect.stringContaining('fan 12') as string,
    });
  });

  it('clears a profile parser error once a profile reads again', async () => {
    await signIn();
    store.state.parserError = { kind: 'profile', message: 'old' };
    fakeBandcamp({ 11: { inCommon: 3, items: 5 } });
    await listSupporters([11]);

    await drainQueue(deps());

    expect(store.state.parserError).toBeNull();
  });
});
