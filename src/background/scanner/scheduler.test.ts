import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fixtureText } from '../../../tests/fixtures';
import { parseReleasePage } from '../../bandcamp';
import { DigheadDb, countJobs, enqueue, fanJob, type JobSpec } from '../../db';
import { DEFAULT_SETTINGS, type Settings } from '../../shared/settings';
import { fetchJson, fetchText } from '../http';
import { releaseProgress } from './progress';
import { drainQueue, type SchedulerDeps } from './scheduler';
import { INITIAL_SCANNER_STATE, type ScannerState, type ScannerStore } from './state';

const SMALL_ALBUM_URL = 'https://doorsdarkmancollective.bandcamp.com/album/summers-fault';
const smallAlbum = parseReleasePage(fixtureText('album-page-small.html'));
const START = new Date(2026, 9, 20, 12, 0, 0).getTime();

type FanBehaviour = number | 'private' | 'broken';

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

/**
 * A fake bandcamp.com behind a mocked global fetch. Fans own N albums, newest first.
 * `interrupt` answers the next requests with a status code or a network failure instead.
 */
function fakeBandcamp(fans: Record<number, FanBehaviour>) {
  const requests: string[] = [];
  const interrupt: ({ status: number; retryAfter?: string } | 'offline')[] = [];

  const fetchMock = vi.fn(async (url: string, init: RequestInit = {}) => {
    const forced = interrupt.shift();
    if (forced === 'offline') throw new TypeError('Failed to fetch');
    if (forced) {
      requests.push(`${forced.status}`);
      const headers = forced.retryAfter ? { 'Retry-After': forced.retryAfter } : undefined;
      return new Response('', { status: forced.status, headers });
    }
    if (url === SMALL_ALBUM_URL) {
      requests.push('page');
      return new Response(fixtureText('album-page-small.html'));
    }
    if (url.endsWith('/collection_items')) {
      const body = JSON.parse(init.body as string) as {
        fan_id: number;
        older_than_token: string;
        count: number;
      };
      requests.push(`fan ${body.fan_id} ${body.older_than_token}`);
      const behaviour = fans[body.fan_id] ?? 0;
      if (behaviour === 'private') return Response.json({ error: true });
      if (behaviour === 'broken') return Response.json({ items: 'nope' });
      const offset = body.older_than_token.startsWith('p:')
        ? Number(body.older_than_token.split(':')[2])
        : 0;
      const end = Math.min(behaviour, offset + body.count);
      const items = [];
      for (let i = offset + 1; i <= end; i++) items.push(rawAlbum(body.fan_id, i));
      return Response.json({ items, more_available: end < behaviour, last_token: null });
    }
    return new Response('', { status: 404 });
  });
  vi.stubGlobal('fetch', fetchMock);
  return { requests, interrupt };
}

function memoryStore(initial: Partial<ScannerState> = {}): ScannerStore & { state: ScannerState } {
  return {
    state: { ...INITIAL_SCANNER_STATE, ...initial },
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
let slept: number[];

function deps(overrides: Partial<SchedulerDeps> = {}): SchedulerDeps {
  return {
    db,
    fetchJson,
    fetchText,
    store,
    loadSettings: async () => settings,
    now: Date.now,
    // Sleeping moves the fake clock instead of waiting.
    sleep: async (ms) => {
      slept.push(ms);
      vi.setSystemTime(Date.now() + ms);
    },
    random: () => 0.5,
    owner: 'worker-1',
    waitForOwnSync: async () => {},
    onStep: async () => {},
    ...overrides,
  };
}

async function queue(specs: JobSpec[], priority = 1) {
  await enqueue(db, specs, priority, Date.now());
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(START);
  db = new DigheadDb(`test-${crypto.randomUUID()}`);
  await db.open();
  store = memoryStore();
  settings = { ...DEFAULT_SETTINGS, collectionBatchSize: 100, collectionCap: 200 };
  slept = [];
});

afterEach(async () => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  await db.delete();
});

describe('drainQueue', () => {
  it('scans every supporter of a release end to end, one paced request at a time', async () => {
    const [small, hidden, big] = smallAlbum.supporters.map((s) => s.fanId) as [
      number,
      number,
      number,
    ];
    const bandcamp = fakeBandcamp({ [small]: 3, [hidden]: 'private', [big]: 250 });
    const steps: string[] = [];
    await queue([{ kind: 'release', target: smallAlbum.item.itemKey, url: SMALL_ALBUM_URL }]);

    const reason = await drainQueue(
      deps({
        onStep: async (job, finished) => void steps.push(`${job.target}${finished ? ' done' : ''}`),
      }),
    );

    expect(reason).toBe('idle');
    expect(bandcamp.requests).toEqual([
      'page',
      expect.stringMatching(new RegExp(`^fan ${small} \\d+::a::$`)),
      expect.stringMatching(new RegExp(`^fan ${hidden} \\d+::a::$`)),
      expect.stringMatching(new RegExp(`^fan ${big} \\d+::a::$`)),
      `fan ${big} p:${big}:100`,
    ]);
    expect(slept).toEqual([2250, 2250, 2250, 2250]);
    expect(store.state.budget?.used).toBe(5);
    expect(store.state.lock).toBeNull();

    const fans = await db.fans.bulkGet([small, hidden, big]);
    expect(fans.map((fan) => fan?.status)).toEqual(['done', 'private', 'partial']);
    expect(fans.map((fan) => fan?.scannedItems)).toEqual([3, 0, 200]);
    expect(fans[0]?.collectionSize).toBe(3);
    expect(await db.ownership.where('fanId').equals(big).count()).toBe(201); // 200 + this release
    expect(await releaseProgress(db, smallAlbum.item.itemKey)).toEqual({
      releaseKey: smallAlbum.item.itemKey,
      scanned: 3,
      total: 3,
      listed: true,
    });
    expect(steps).toEqual([
      `${smallAlbum.item.itemKey} done`,
      `${small} done`,
      `${hidden} done`,
      `${big}`,
      `${big} done`,
    ]);
  });

  it('pauses the whole queue on a 429, honours Retry-After, then resumes', async () => {
    const bandcamp = fakeBandcamp({ 7: 2 });
    bandcamp.interrupt.push({ status: 429, retryAfter: '120' });
    await queue([fanJob(7)]);

    expect(await drainQueue(deps())).toBe('paused');
    expect(store.state.backoff).toEqual({ failures: 1, until: START + 120_000 });
    expect(await db.queue.toArray()).toEqual([
      expect.objectContaining({ target: '7', attempts: 0, cursor: null }),
    ]);

    vi.setSystemTime(START + 119_000);
    expect(await drainQueue(deps())).toBe('paused');
    expect(bandcamp.requests).toEqual(['429']);

    vi.setSystemTime(START + 120_000);
    expect(await drainQueue(deps())).toBe('idle');
    expect(await db.ownership.where('fanId').equals(7).count()).toBe(2);
    expect(store.state.backoff).toBeNull();
  });

  it('backs off exponentially from 60 s on 5xx and network failures', async () => {
    const bandcamp = fakeBandcamp({ 7: 1 });
    bandcamp.interrupt.push({ status: 503 }, 'offline');
    await queue([fanJob(7)]);

    await drainQueue(deps());
    expect(store.state.backoff).toEqual({ failures: 1, until: START + 60_000 });

    vi.setSystemTime(START + 60_000);
    await drainQueue(deps());
    expect(store.state.backoff?.failures).toBe(2);
    expect(store.state.backoff?.until).toBe(Date.now() + 120_000);
  });

  it('stops at the daily budget and carries on after local midnight', async () => {
    const bandcamp = fakeBandcamp({ 1: 1, 2: 1, 3: 1 });
    settings.dailyRequestBudget = 2;
    await queue([fanJob(1), fanJob(2), fanJob(3)]);

    expect(await drainQueue(deps())).toBe('paused');
    expect(bandcamp.requests).toHaveLength(2);

    vi.setSystemTime(new Date(2026, 9, 21, 0, 0, 1));
    expect(await drainQueue(deps())).toBe('idle');
    expect(bandcamp.requests).toHaveLength(3);
    expect(store.state.budget).toEqual({ day: '2026-10-21', used: 1 });
  });

  it('resumes a fan from its saved cursor after the worker is killed', async () => {
    settings.collectionCap = 2000;
    const bandcamp = fakeBandcamp({ 9: 250 });
    await queue([fanJob(9)]);
    // The worker dies during the pause before its second request, holding the lock.
    await expect(
      drainQueue(
        deps({
          sleep: async () => {
            store.state.lock = { owner: 'worker-1', heartbeatAt: Date.now() };
            throw new Error('killed');
          },
        }),
      ),
    ).rejects.toThrow('killed');
    store.state.lock = { owner: 'worker-1', heartbeatAt: Date.now() };

    const restarted = deps({ owner: 'worker-2' });
    expect(await drainQueue(restarted)).toBe('locked');
    vi.setSystemTime(Date.now() + 46_000);
    expect(await drainQueue(restarted)).toBe('idle');

    expect(bandcamp.requests.slice(1)).toEqual(['fan 9 p:9:100', 'fan 9 p:9:200']);
    expect(await db.ownership.where('fanId').equals(9).count()).toBe(250);
  });

  it('drops jobs that cannot succeed, marks the fan, and moves on', async () => {
    fakeBandcamp({ 4: 'broken', 5: 1 });
    await db.fans.bulkPut(
      [4, 5].map((fanId) => ({
        fanId,
        username: `fan${fanId}`,
        name: `Fan ${fanId}`,
        imageId: null,
        collectionSize: null,
        scannedItems: 0,
        collectionFetchedAt: null,
        status: 'queued' as const,
      })),
    );
    await queue([
      { kind: 'release', target: 'a404', url: 'https://gone.bandcamp.com/album/x' },
      fanJob(4),
      fanJob(5),
    ]);

    expect(await drainQueue(deps())).toBe('idle');

    expect(await countJobs(db)).toEqual({ release: 0, fan: 0 });
    expect((await db.fans.get(4))?.status).toBe('error');
    expect((await db.fans.get(5))?.status).toBe('done');
    expect(store.state.lastError).toBeNull(); // cleared by the success after it
  });

  it('retries a job that failed for an unknown reason, without pausing the queue', async () => {
    fakeBandcamp({ 1: 1 });
    await queue([fanJob(1)]);

    expect(
      await drainQueue(
        deps({
          fetchJson: async () => {
            throw new Error('something unexpected');
          },
        }),
      ),
    ).toBe('idle');

    expect(store.state.backoff).toBeNull();
    expect(await db.queue.toArray()).toEqual([
      expect.objectContaining({ attempts: 1, nextAttemptAt: START + 60_000 }),
    ]);
    expect(store.state.lastError).toContain('something unexpected');
  });
});
