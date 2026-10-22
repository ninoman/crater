// Estimates how big the IndexedDB database gets for a heavy user. Usage: pnpm storage:estimate
//
// Record sizes come from real fixture data run through the real mappers, serialized the way
// Chrome stores IndexedDB values (V8 structured clone). Each index adds an entry holding its
// key plus the primary key. LevelDB's own compression is ignored, so this leans high.

import { serialize } from 'node:v8';
import { parseCollectionPage, parseSupportersPage } from '../src/bandcamp';
import { fanFromSupporter, itemFromCollection, ownershipFromCollection } from '../src/db/mappers';
import { storeItem, storeOwnership } from '../src/db/storage';
import { DEFAULT_SETTINGS } from '../src/shared/settings';
import { fixtureJson } from '../tests/fixtures';

/** LevelDB key prefix, sequence number and length varints, per entry. */
const ENTRY_OVERHEAD = 16;

/** Encoded size of an IndexedDB key (Chrome's IDBKey encoding: strings are UTF-16). */
function keySize(key: number | string | (number | string)[]): number {
  if (Array.isArray(key)) return 2 + key.reduce<number>((sum, part) => sum + keySize(part), 0);
  return typeof key === 'number' ? 9 : 2 + key.length * 2;
}

function valueSize(value: unknown): number {
  return serialize(value).length;
}

/** Bytes for one record: its value under its primary key, plus one entry per index key. */
function recordSize(
  value: unknown,
  primary: number | string | (number | string)[],
  indexKeys: (number | string | (number | string)[])[],
): number {
  const pk = keySize(primary);
  const own = ENTRY_OVERHEAD + pk + valueSize(value);
  return own + indexKeys.reduce<number>((sum, key) => sum + ENTRY_OVERHEAD + keySize(key) + pk, 0);
}

const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;

// Per-record sizes from the fixtures.
const collection = [
  ...parseCollectionPage(fixtureJson('collection_items-p1.json')).items,
  ...parseCollectionPage(fixtureJson('collection_items-p2.json')).items,
];
const supporters = parseSupportersPage(fixtureJson('tralbumcollectors-thumbs-p2.json'), 'thumbs')
  .supporters;
const now = Date.now();

const itemBytes = mean(
  collection.map((item) => {
    // Stored as v12 does (decisions §19), its band's host already known.
    const record = itemFromCollection(item);
    const { stored } = storeItem(record, storeItem(record, undefined).band);
    return recordSize(stored, record.itemKey, [
      record.bandId,
      ...(record.albumKey ? [record.albumKey] : []),
      ...(record.labelId !== null ? [record.labelId] : []),
    ]);
  }),
);
const ownershipBytes = mean(
  collection.map((item) => {
    const row = storeOwnership(ownershipFromCollection(123_456_789, item, 'collection'));
    return recordSize(row, [row.fanId, row.itemKey], [row.matchKey]);
  }),
);
const fanBytes = mean(
  supporters.map((supporter) => {
    const fan = { ...fanFromSupporter(supporter, now), status: 'done' as const };
    return recordSize(fan, fan.fanId, [fan.status, now, now]);
  }),
);
/** Fixed part of a fanMatches record; each match id adds 8 bytes to its Float64Array. */
const fanMatchesBase = recordSize({ fanId: 1, matchIds: new Float64Array() }, 1, []);
const matchOwnersBytes = recordSize({ matchId: 3_149_089_081, owners: 12 }, 3_149_089_081, []);

interface Scenario {
  name: string;
  ownItems: number;
  fans: number;
  itemsPerFan: number;
  /** Share of fan-owned rows that are a release no one else in the DB owns. */
  newItemShare: number;
}

function estimate(s: Scenario) {
  const fanRows = s.fans * s.itemsPerFan;
  const rows = fanRows + s.ownItems;
  const items = Math.round(s.ownItems + fanRows * s.newItemShare);
  // One supporter list per cap's worth of fans, each fan id indexed once (multiEntry).
  const releases = Math.ceil(s.fans / DEFAULT_SETTINGS.supportersPerReleaseCap);
  const perList = DEFAULT_SETTINGS.supportersPerReleaseCap;
  const supporterLists =
    releases * recordSize({ itemKey: 'a1', fanIds: Array(perList).fill(1e9), fetchedAt: now }, 'a1', [])
    + s.fans * (ENTRY_OVERHEAD + keySize(1e9) + keySize('a3149089081'));
  const tables = {
    ownership: rows * ownershipBytes,
    items: items * itemBytes,
    fanMatches: (s.fans + 1) * fanMatchesBase + rows * 8,
    matchOwners: items * matchOwnersBytes,
    fans: s.fans * fanBytes,
    releaseSupporters: supporterLists,
  };
  const total = Object.values(tables).reduce((a, b) => a + b, 0);
  return { rows, items, tables, total };
}

const mb = (bytes: number) => `${(bytes / 1024 ** 2).toFixed(0)} MB`;
const gb = (bytes: number) => `${(bytes / 1024 ** 3).toFixed(2)} GB`;

console.log('Per record (bytes, with index entries):');
console.log(`  ownership ${ownershipBytes.toFixed(0)}, item ${itemBytes.toFixed(0)}, fan ${fanBytes.toFixed(0)}, matchOwners ${matchOwnersBytes}, fanMatches ${fanMatchesBase} + 8 per id`);

const scenarios: Scenario[] = [
  { name: 'Worst case: every fan at the 2,000-item cap', ownItems: 5000, fans: 20_000, itemsPerFan: DEFAULT_SETTINGS.collectionCap, newItemShare: 0.1 },
  { name: 'Heavy but typical: 500 items per fan on average', ownItems: 5000, fans: 20_000, itemsPerFan: 500, newItemShare: 0.15 },
];

for (const scenario of scenarios) {
  const { rows, items, tables, total } = estimate(scenario);
  console.log(`\n${scenario.name}`);
  console.log(`  ${scenario.fans} fans, ${rows.toLocaleString('en')} ownership rows, ${items.toLocaleString('en')} items`);
  for (const [table, bytes] of Object.entries(tables)) console.log(`  ${table.padEnd(18)} ${mb(bytes)}`);
  console.log(`  ${'total'.padEnd(18)} ${gb(total)}`);
}
