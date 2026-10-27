// ROADMAP Deep cuts step 2: a Deep cuts score over a 100-crate-mate board stays under ~200 ms. The same
// board also times a For you score and a crate mates recompute (decisions §19).
// Crate mates hold full 2,000-item collections, and Bandcamp counts follow popularity, so the releases
// most crate mates share (highest ceilings) are mostly over the cap: the worst case for pruning.
// fake-indexeddb is slower than Chrome's IndexedDB, so passing here leaves headroom.

import 'fake-indexeddb/auto';
import type { Table } from 'dexie';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { keyToNumber, type ItemKey } from '../../src/bandcamp';
import { computeDeepCuts } from '../../src/background/recommend/deepCuts';
import { computeForYou } from '../../src/background/recommend/forYou';
import { computeCrateMates } from '../../src/background/recommend/crateMates';
import {
  buildMatchIndex,
  CraterDb,
  gatherForYou,
  getCrateMates,
  type ItemRecord,
  type MeRecord,
  type OwnershipRecord,
  type CrateMateRecord,
} from '../../src/db';
import { storedRows } from './stored';
import { rankDeepCuts } from '../../src/scoring/deepCuts';
import { exclusions } from '../../src/scoring/exclusions';
import { topCrateMates, crateMateOwnership } from '../../src/scoring/forYou';
import { DEEP_CUT_CRATE_MATES_K } from '../../src/scoring/weights';
import { DEFAULT_SETTINGS } from '../../src/shared/settings';

const CRATE_MATES = 200;
const ITEMS_PER_CRATE_MATE = 2000;
const CATALOG = 100_000;
const ME = 1;
const MY_ITEMS = 1000;
const CAP = 50;
const BUDGET_MS = 200;
/** A recompute runs in the background after scans, not while you wait, so it gets more room. */
const CRATE_MATES_BUDGET_MS = 2000;
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

/** Distinct items, skewed so low indexes are owned widely and most by almost nobody. */
function collection(next: () => number, size: number): ItemKey[] {
  const keys = new Set<ItemKey>();
  while (keys.size < size) keys.add(`a${Math.floor(CATALOG * next() ** 2)}`);
  return [...keys];
}

function row(fanId: number, itemKey: ItemKey): OwnershipRecord {
  return { fanId, itemKey, matchKey: itemKey, source: 'collection', addedAt: null };
}

let db: CraterDb;
const me: MeRecord = { id: 'self', fanId: ME, username: 'me', syncedAt: 0 };

beforeAll(async () => {
  db = new CraterDb(`perf-${crypto.randomUUID()}`);
  await db.open();
  const next = random(7);

  const rows: OwnershipRecord[] = [];
  for (let fanId = 100; fanId < 100 + CRATE_MATES; fanId++) {
    for (const key of collection(next, ITEMS_PER_CRATE_MATE)) rows.push(row(fanId, key));
  }
  for (const key of collection(next, MY_ITEMS)) rows.push(row(ME, key));

  // Popular releases have big counts: ~5,000 at the head, 50 by index ~5,000, ~3 in the tail.
  // A tenth have no Bandcamp count.
  const items: ItemRecord[] = Array.from({ length: CATALOG }, (_, i) => ({
    itemKey: `a${i}`,
    albumKey: null,
    title: `Album ${i}`,
    artist: `Artist ${i % 3000}`,
    bandId: i % 500,
    label: null,
    labelId: null,
    url: `https://artist.bandcamp.com/album/${i}`,
    artId: i,
    tags: [],
    supporterCount: i % 10 === 0 ? null : Math.round(1 + 5000 / (1 + i / 50)),
    compilation: false,
  }));

  const crateMates = Array.from(
    { length: CRATE_MATES },
    (_, i): CrateMateRecord => ({
      fanId: 100 + i,
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
  const stored = storedRows(items, rows);
  for (const [table, records] of [
    [db.ownership, stored.ownership],
    [db.fanMatches, index.fanMatches],
    [db.matchOwners, index.matchOwners],
    [db.items, stored.items],
    [db.bands, stored.bands],
    [db.crateMates, crateMates],
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

it(`scores Deep cuts over a ${DEEP_CUT_CRATE_MATES_K}-crate-mate board in under ${BUDGET_MS} ms`, async () => {
  const input = { maxSupporters: CAP, ignoreCompilations: true, hideHeard: false };
  await computeDeepCuts(db, me, input); // warm-up

  const times: number[] = [];
  let result = await computeDeepCuts(db, me, input);
  for (let run = 0; run < 5; run++) {
    const started = performance.now();
    result = await computeDeepCuts(db, me, input);
    times.push(performance.now() - started);
  }
  const median = times.sort((a, b) => a - b)[2] ?? Infinity;
  const owners = result.rows.map((r) => r.supporters).sort((a, b) => a - b);
  console.log(
    `deep cuts: median ${median.toFixed(1)} ms, runs ${times.map(Math.round).join(', ')}; ` +
      `${result.rows.length} rows from ${result.crateMatesUsed} crate mates, owners ${owners[0]}–${owners.at(-1)}`,
  );

  // How much pruning saves: candidates against item records actually looked up.
  const board = topCrateMates(await getCrateMates(db), DEEP_CUT_CRATE_MATES_K);
  const data = await gatherForYou(
    db,
    board.map((t) => t.fanId),
    ME,
  );
  const scoreOf = new Map(board.map((t) => [t.fanId, t.score]));
  const owned = crateMateOwnership(
    data.crateMateLists.map((l) => ({ score: scoreOf.get(l.fanId) ?? 0, matches: l.matchIds })),
    exclusions(data.mine, data.hidden).ids,
  );
  const counts = new Map(
    (await db.items.toArray()).map((item) => [keyToNumber(item.itemKey), item.supporterCount]),
  );
  let looked = 0;
  rankDeepCuts(
    owned,
    (id) => {
      looked++;
      return { supporterCount: counts.get(id) ?? null, compilation: false };
    },
    { maxSupporters: CAP, limit: 60 },
  );
  console.log(`deep cuts: ${owned.length} candidates, ${looked} looked up`);

  expect(result.crateMatesUsed).toBe(DEEP_CUT_CRATE_MATES_K);
  expect(result.rows).toHaveLength(30);
  expect(result.rows.every((r) => r.supporters <= CAP)).toBe(true);
  expect(median).toBeLessThan(BUDGET_MS);
});

/** Median of five timed runs after one warm-up. */
async function median(run: () => Promise<unknown>): Promise<number> {
  await run();
  const times: number[] = [];
  for (let i = 0; i < 5; i++) {
    const started = performance.now();
    await run();
    times.push(performance.now() - started);
  }
  return times.sort((a, b) => a - b)[2] ?? Infinity;
}

it(`scores For you over the top ${DEFAULT_SETTINGS.topCrateMatesK} crate mates in under ${BUDGET_MS} ms`, async () => {
  const input = {
    mode: 'all' as const,
    topCrateMatesK: DEFAULT_SETTINGS.topCrateMatesK,
    latelyHalfLifeMonths: DEFAULT_SETTINGS.latelyHalfLifeMonths,
    followingBoost: true,
    ignoreCompilations: true,
    hideHeard: false,
    now: 0,
  };
  const ms = await median(() => computeForYou(db, me, input));
  console.log(`for you: median ${ms.toFixed(1)} ms`);
  expect((await computeForYou(db, me, input)).rows).toHaveLength(30);
  expect(ms).toBeLessThan(BUDGET_MS);
});

// Last: it replaces the board the other checks read.
it(`recomputes crate mates over ${CRATE_MATES} full collections in under ${CRATE_MATES_BUDGET_MS} ms`, async () => {
  await db.fans.bulkPut(
    Array.from({ length: CRATE_MATES }, (_, i) => ({
      fanId: 100 + i,
      username: `fan${i}`,
      name: `Fan ${i}`,
      imageId: null,
      collectionSize: ITEMS_PER_CRATE_MATE,
      scannedItems: ITEMS_PER_CRATE_MATE,
      collectionFetchedAt: 0,
      status: 'done' as const,
      lastSeenAt: 0,
    })),
  );
  const deps = { db, settings: DEFAULT_SETTINGS, now: 0, yieldNow: async () => undefined };
  const ms = await median(() => computeCrateMates(deps, ME));
  console.log(`crate mates: median ${ms.toFixed(1)} ms`);
  expect(await db.crateMates.count()).toBe(CRATE_MATES);
  expect(ms).toBeLessThan(CRATE_MATES_BUDGET_MS);
});
