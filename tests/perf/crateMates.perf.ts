// A first crate mates compute for a 1,000-release collection against a big pool of read fans:
// the case where the tab used to sit on a skeleton for minutes. fake-indexeddb is slower than
// Chrome's IndexedDB, so passing here leaves headroom.

import 'fake-indexeddb/auto';
import type { Table } from 'dexie';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { type ItemKey, keyToNumber } from '../../src/bandcamp';
import { computeCrateMates } from '../../src/background/recommend/crateMates';
import {
  buildMatchIndex,
  CraterDb,
  type FanMatchesRecord,
  type FanRecord,
  type ItemRecord,
  type OwnershipRecord,
} from '../../src/db';
import { DEFAULT_SETTINGS } from '../../src/shared/settings';
import { storedRows } from './stored';

const MY_ITEMS = 1_000;
const FANS = 30_000;
const ITEMS_PER_FAN = 300;
const CATALOG = 60_000;
const ME = 1;
const SEED_CHUNK = 2_000;
const BUDGET_MS = 30_000;

function random(seed: number): () => number {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Distinct catalog numbers, skewed so a few releases are owned widely. */
function collection(next: () => number, size: number): number[] {
  const ids = new Set<number>();
  while (ids.size < size) ids.add(2 + Math.floor(CATALOG * next() ** 3));
  return [...ids];
}

const key = (id: number): ItemKey => `a${id}`;

let db: CraterDb;

beforeAll(async () => {
  db = new CraterDb(`perf-${crypto.randomUUID()}`);
  await db.open();
  const next = random(7);

  const mine: OwnershipRecord[] = collection(next, MY_ITEMS).map((id) => ({
    fanId: ME,
    itemKey: key(id),
    matchKey: key(id),
    source: 'collection',
    addedAt: null,
  }));
  const items: ItemRecord[] = Array.from({ length: CATALOG + 2 }, (_, i) => ({
    itemKey: key(i),
    albumKey: null,
    title: `Album ${i}`,
    artist: 'Artist',
    bandId: i % 500,
    label: null,
    labelId: null,
    url: `https://artist.bandcamp.com/album/${i}`,
    artId: i,
    tags: [],
    supporterCount: 10,
    compilation: false,
  }));
  const fans: FanRecord[] = [];
  const fanMatches: FanMatchesRecord[] = [];
  for (let fanId = 100; fanId < 100 + FANS; fanId++) {
    fans.push({
      fanId,
      username: `fan${fanId}`,
      name: `Fan ${fanId}`,
      imageId: null,
      collectionSize: null,
      scannedItems: ITEMS_PER_FAN,
      collectionFetchedAt: 0,
      status: 'done',
      lastSeenAt: 0,
    });
    const ids = Float64Array.from(
      collection(next, ITEMS_PER_FAN).map((id) => keyToNumber(key(id))),
    ).sort();
    fanMatches.push({
      fanId,
      matchIds: ids,
      trackIds: new Float64Array(),
      partialIds: new Float64Array(),
      matchTimes: new Float64Array(ids.length),
    });
  }
  fans.push({ ...fans[0], fanId: ME, username: 'me' } as FanRecord);

  const index = buildMatchIndex(mine);
  const stored = storedRows(items, mine);
  for (const [table, records] of [
    [db.fanOwnership, stored.fanOwnership],
    [db.matchOwnership, stored.matchOwnership],
    [db.fanMatches, [...index.fanMatches, ...fanMatches]],
    [db.matchOwners, index.matchOwners],
    [db.fans, fans],
    [db.items, stored.items],
    [db.bands, stored.bands],
  ] as const) {
    for (let start = 0; start < records.length; start += SEED_CHUNK) {
      await (table as Table).bulkPut(records.slice(start, start + SEED_CHUNK));
    }
  }
});

afterAll(async () => {
  await db.delete();
});

it(`computes crate mates for ${MY_ITEMS} releases against ${FANS} fans in under ${BUDGET_MS} ms`, async () => {
  const started = performance.now();
  const records = await computeCrateMates(
    { db, settings: DEFAULT_SETTINGS, now: Date.now(), yieldNow: async () => {} },
    ME,
  );
  const took = performance.now() - started;
  console.log(`compute: ${Math.round(took)} ms, ${records.length} crate mates`);
  expect(records.length).toBeGreaterThan(0);
  expect(took).toBeLessThan(BUDGET_MS);
});
