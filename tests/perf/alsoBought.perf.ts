// ROADMAP Phase 4 step 8: a re-score stays under ~200 ms with ~300k ownership rows, with a full
// twins leaderboard so the twin boost (Phase 5) is part of the measurement.
// fake-indexeddb is slower than Chrome's IndexedDB, so passing here leaves headroom.

import 'fake-indexeddb/auto';
import type { Table } from 'dexie';
import { afterAll, beforeAll, expect, it } from 'vitest';
import type { ItemKey } from '../../src/bandcamp';
import { computeAlsoBought } from '../../src/background/recommend/alsoBought';
import {
  buildMatchIndex,
  DigheadDb,
  type FanRecord,
  type ItemRecord,
  type OwnershipRecord,
  type TwinRecord,
} from '../../src/db';

const SUPPORTERS = 300;
const ITEMS_PER_FAN = 1000;
const CATALOG = 60_000;
const OTHER_FANS = 2_000;
/** The leaderboard keeps 200 twins; this many of them are the release's supporters. */
const TWINS = 200;
const TWIN_SUPPORTERS = 50;
const ME = 1;
const RELEASE: ItemKey = 'a1';
const BUDGET_MS = 200;
/** fake-indexeddb slows down sharply with very large transactions. */
const SEED_CHUNK = 5_000;

/** Deterministic PRNG (mulberry32), so every run seeds the same data. */
function random(seed: number): () => number {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Distinct items, skewed so a few are owned widely and most by almost nobody. */
function collection(next: () => number, size: number): ItemKey[] {
  const keys = new Set<ItemKey>();
  while (keys.size < size) keys.add(`a${2 + Math.floor(CATALOG * next() ** 3)}`);
  return [...keys];
}

function row(fanId: number, itemKey: ItemKey): OwnershipRecord {
  return { fanId, itemKey, matchKey: itemKey, source: 'collection', addedAt: null };
}

function fan(fanId: number): FanRecord {
  return {
    fanId,
    username: `fan${fanId}`,
    name: `Fan ${fanId}`,
    imageId: null,
    collectionSize: null,
    scannedItems: ITEMS_PER_FAN,
    collectionFetchedAt: 0,
    status: 'done',
    lastSeenAt: 0,
  };
}

let db: DigheadDb;

beforeAll(async () => {
  db = new DigheadDb(`perf-${crypto.randomUUID()}`);
  await db.open();
  const next = random(42);

  const rows: OwnershipRecord[] = [];
  const fans: FanRecord[] = [];
  for (let fanId = 100; fanId < 100 + SUPPORTERS; fanId++) {
    fans.push(fan(fanId));
    rows.push(row(fanId, RELEASE));
    for (const key of collection(next, ITEMS_PER_FAN - 1)) rows.push(row(fanId, key));
  }
  for (let fanId = 10_000; fanId < 10_000 + OTHER_FANS; fanId++) {
    fans.push(fan(fanId));
    for (const key of collection(next, 5)) rows.push(row(fanId, key));
  }
  for (const key of collection(next, ITEMS_PER_FAN)) rows.push(row(ME, key));

  const items: ItemRecord[] = Array.from({ length: CATALOG + 2 }, (_, i) => ({
    itemKey: `a${i}`,
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
    fetchedAt: 0,
  }));

  const twinIds = [
    ...Array.from({ length: TWIN_SUPPORTERS }, (_, i) => 100 + i * 6),
    ...Array.from({ length: TWINS - TWIN_SUPPORTERS }, (_, i) => 10_000 + i),
  ];
  const twins = twinIds.map(
    (fanId, i): TwinRecord => ({
      fanId,
      overlap: 50,
      jaccard: 0.05,
      score: 1 / (1 + i),
      labelCluster: false,
      lately: null,
      yearAgo: null,
      latelyOverlap: 0,
      computedAt: 0,
    }),
  );

  const started = performance.now();
  const index = buildMatchIndex(rows);
  for (const [table, records] of [
    [db.ownership, rows],
    [db.fanMatches, index.fanMatches],
    [db.matchOwners, index.matchOwners],
    [db.fans, fans],
    [db.items, items],
    [db.twins, twins],
    // Every supporter listed and scanned, so the warm-up is over and co-owned rows show.
    [
      db.releaseSupporters,
      [{ itemKey: RELEASE, fanIds: fans.slice(0, SUPPORTERS).map((f) => f.fanId), fetchedAt: 0 }],
    ],
  ] as const) {
    for (let start = 0; start < records.length; start += SEED_CHUNK) {
      await (table as Table).bulkPut(records.slice(start, start + SEED_CHUNK));
    }
  }
  console.log(
    `seeded ${rows.length} ownership rows in ${Math.round(performance.now() - started)} ms`,
  );
});

afterAll(async () => {
  await db.delete();
});

it(`re-scores a release with ${SUPPORTERS} scanned supporters in under ${BUDGET_MS} ms`, async () => {
  expect(await db.ownership.count()).toBeGreaterThanOrEqual(300_000);
  await computeAlsoBought(db, RELEASE, ME); // warm-up

  const times: number[] = [];
  let rows = 0;
  let coOwned = 0;
  for (let run = 0; run < 5; run++) {
    const started = performance.now();
    const result = await computeAlsoBought(db, RELEASE, ME);
    rows = result.rows.length;
    coOwned = result.rows.filter((row) => row.reason.kind === 'co-owned').length;
    times.push(performance.now() - started);
  }
  const median = times.sort((a, b) => a - b)[2] ?? Infinity;
  console.log(`re-score: median ${median.toFixed(1)} ms, runs ${times.map(Math.round).join(', ')}`);

  expect(rows).toBe(30);
  expect(coOwned).toBe(30);
  expect(median).toBeLessThan(BUDGET_MS);
});
