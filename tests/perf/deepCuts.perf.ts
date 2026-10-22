// ROADMAP Deep cuts step 2: a Deep cuts score over a 100-twin board stays under ~200 ms.
// Twins hold full 2,000-item collections, and Bandcamp counts follow popularity, so the releases
// most twins share (highest ceilings) are mostly over the cap: the worst case for pruning.
// fake-indexeddb is slower than Chrome's IndexedDB, so passing here leaves headroom.

import 'fake-indexeddb/auto';
import type { Table } from 'dexie';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { keyToNumber, type ItemKey } from '../../src/bandcamp';
import { computeDeepCuts } from '../../src/background/recommend/deepCuts';
import {
  buildMatchIndex,
  DigheadDb,
  gatherForYou,
  getTwins,
  type ItemRecord,
  type MeRecord,
  type OwnershipRecord,
  type TwinRecord,
} from '../../src/db';
import { rankDeepCuts } from '../../src/scoring/deepCuts';
import { exclusions } from '../../src/scoring/exclusions';
import { topTwins, twinOwnership } from '../../src/scoring/forYou';
import { DEEP_CUT_TWINS_K } from '../../src/scoring/weights';

const TWINS = 200;
const ITEMS_PER_TWIN = 2000;
const CATALOG = 100_000;
const ME = 1;
const MY_ITEMS = 1000;
const CAP = 50;
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

/** Distinct items, skewed so low indexes are owned widely and most by almost nobody. */
function collection(next: () => number, size: number): ItemKey[] {
  const keys = new Set<ItemKey>();
  while (keys.size < size) keys.add(`a${Math.floor(CATALOG * next() ** 2)}`);
  return [...keys];
}

function row(fanId: number, itemKey: ItemKey): OwnershipRecord {
  return { fanId, itemKey, matchKey: itemKey, source: 'collection', addedAt: null };
}

let db: DigheadDb;
const me: MeRecord = { id: 'self', fanId: ME, username: 'me', syncedAt: 0 };

beforeAll(async () => {
  db = new DigheadDb(`perf-${crypto.randomUUID()}`);
  await db.open();
  const next = random(7);

  const rows: OwnershipRecord[] = [];
  for (let fanId = 100; fanId < 100 + TWINS; fanId++) {
    for (const key of collection(next, ITEMS_PER_TWIN)) rows.push(row(fanId, key));
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
    fetchedAt: 0,
  }));

  const twins = Array.from(
    { length: TWINS },
    (_, i): TwinRecord => ({
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
  for (const [table, records] of [
    [db.ownership, rows],
    [db.fanMatches, index.fanMatches],
    [db.matchOwners, index.matchOwners],
    [db.items, items],
    [db.twins, twins],
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

it(`scores Deep cuts over a ${DEEP_CUT_TWINS_K}-twin board in under ${BUDGET_MS} ms`, async () => {
  const input = { maxSupporters: CAP, ignoreCompilations: true };
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
      `${result.rows.length} rows from ${result.twinsUsed} twins, owners ${owners[0]}–${owners.at(-1)}`,
  );

  // How much pruning saves: candidates against item records actually looked up.
  const board = topTwins(await getTwins(db), DEEP_CUT_TWINS_K);
  const data = await gatherForYou(
    db,
    board.map((t) => t.fanId),
    ME,
  );
  const scoreOf = new Map(board.map((t) => [t.fanId, t.score]));
  const owned = twinOwnership(
    data.twinLists.map((l) => ({ score: scoreOf.get(l.fanId) ?? 0, matches: l.matchIds })),
    exclusions(data.mine, data.hidden),
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

  expect(result.twinsUsed).toBe(DEEP_CUT_TWINS_K);
  expect(result.rows).toHaveLength(30);
  expect(result.rows.every((r) => r.supporters <= CAP)).toBe(true);
  expect(median).toBeLessThan(BUDGET_MS);
});
