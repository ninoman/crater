// What scans write per request with ownership packed one record per fan (decisions §27): a
// collection page of 100 items, and a supporter page of 100 fans. Each also rewrites the
// matchKey lists those rows join, and refreshes the match index.

import 'fake-indexeddb/auto';
import { afterAll, beforeAll, expect, it } from 'vitest';
import type { CollectionItem, ItemKey, Supporter } from '../../src/bandcamp';
import {
  addSupporterOwnership,
  buildMatchIndex,
  buildPackedOwnership,
  CraterDb,
  fanRows,
  type OwnershipRecord,
  putOwnership,
} from '../../src/db';

const FANS = 600;
const ITEMS_PER_FAN = 500;
/** A catalog this small gives the widely owned releases lists of hundreds of fans. */
const CATALOG = 8_000;
const PAGE = 100;
const RUNS = 5;
const BUDGET_MS = 200;
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

const next = random(7);
const pick = (): ItemKey => `a${1 + Math.floor(CATALOG * next() ** 2)}`;

function collectionItem(itemKey: ItemKey): CollectionItem {
  return {
    itemKey,
    albumKey: null,
    title: 'Title',
    artist: 'Artist',
    bandId: 1,
    url: 'https://artist.bandcamp.com/album/title',
    artId: null,
    purchaseKind: 'album',
    label: null,
    labelId: null,
    otherOwners: null,
    addedAt: 1_700_000_000_000,
    compilation: false,
  };
}

function supporter(fanId: number): Supporter {
  return {
    fanId,
    username: `fan${fanId}`,
    name: '',
    imageId: null,
    token: '1:1700000000:1:0:1:0',
    purchasedAt: 1_700_000_000_000,
    isReviewer: false,
  };
}

let db: CraterDb;

beforeAll(async () => {
  db = new CraterDb(`perf-writes-${crypto.randomUUID()}`);
  await db.open();
  const rows: OwnershipRecord[] = [];
  for (let fanId = 1; fanId <= FANS; fanId++) {
    const keys = new Set<ItemKey>();
    while (keys.size < ITEMS_PER_FAN) keys.add(pick());
    for (const itemKey of keys) {
      rows.push({ fanId, itemKey, matchKey: itemKey, source: 'collection', addedAt: null });
    }
  }
  const packed = buildPackedOwnership(rows);
  const index = buildMatchIndex(rows);
  for (const [table, records] of [
    [db.fanOwnership, packed.fanOwnership],
    [db.matchOwnership, packed.matchOwnership],
    [db.fanMatches, index.fanMatches],
    [db.matchOwners, index.matchOwners],
  ] as const) {
    for (let start = 0; start < records.length; start += SEED_CHUNK) {
      await (table as { bulkPut(rows: unknown[]): Promise<unknown> }).bulkPut(
        records.slice(start, start + SEED_CHUNK),
      );
    }
  }
});

afterAll(async () => {
  await db.delete();
});

const median = (times: number[]) =>
  [...times].sort((a, b) => a - b)[Math.floor(times.length / 2)] as number;

it(`writes a ${PAGE}-item collection page in under ${BUDGET_MS} ms`, async () => {
  const times: number[] = [];
  for (let run = 0; run < RUNS; run++) {
    const fanId = 10 + run;
    const owned = new Set((await fanRows(db, fanId)).map((row) => row.itemKey));
    const page: CollectionItem[] = [];
    while (page.length < PAGE) {
      const key = pick();
      if (!owned.has(key) && !page.some((item) => item.itemKey === key))
        page.push(collectionItem(key));
    }
    const started = performance.now();
    await putOwnership(db, fanId, page, 'collection');
    times.push(performance.now() - started);
    expect((await fanRows(db, fanId)).length).toBe(ITEMS_PER_FAN + PAGE);
  }
  console.log(
    `collection page: median ${median(times).toFixed(1)} ms, runs ${times.map(Math.round).join(', ')}`,
  );
  expect(median(times)).toBeLessThan(BUDGET_MS);
});

it(`writes a ${PAGE}-fan supporter page in under ${BUDGET_MS} ms`, async () => {
  const times: number[] = [];
  for (let run = 0; run < RUNS; run++) {
    // A release none of them own yet, so every supporter gets a row.
    const release: ItemKey = `a${CATALOG + 1 + run}`;
    const fans = Array.from({ length: PAGE }, (_, i) => 100 + run * PAGE + i);
    const started = performance.now();
    await addSupporterOwnership(db, { itemKey: release, albumKey: null }, fans.map(supporter));
    times.push(performance.now() - started);
  }
  console.log(
    `supporter page: median ${median(times).toFixed(1)} ms, runs ${times.map(Math.round).join(', ')}`,
  );
  expect(median(times)).toBeLessThan(BUDGET_MS);
});
