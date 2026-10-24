import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { importInto } from 'dexie-export-import';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
  DigheadDb,
  ensureFileReader,
  exportDatabase,
  importDatabase,
  readBackup,
} from '../../src/db';
import { memorySnapshot } from '../memorySnapshot';
import { collectOutputs } from './outputs';
import { buildScenario } from './scenario';

// golden.json holds every output of the scenario, recorded on the code before the v12 storage
// change, and v11-backup.json the scenario's database as that code exported it. Storage changes
// must leave every output alone, however the data got there (decisions §19).
// `UPDATE_GOLDEN=1 pnpm test tests/golden` re-records both: only on code known to be right.
const GOLDEN = join(import.meta.dirname, 'golden.json');
const V11_BACKUP = join(import.meta.dirname, 'v11-backup.json');

// The scenario is a whole database in fake-indexeddb: ~0.5s alone, but several seconds when
// the full suite's workers compete for CPU, which overran the 5s default.
vi.setConfig({ testTimeout: 30_000 });

/** The v11 stores, so a test can make a database as that build left it. */
const V11_STORES = {
  items: 'itemKey, bandId, albumKey, labelId, url',
  fans: 'fanId, status, collectionFetchedAt, lastSeenAt',
  ownership: '[fanId+itemKey], fanId, itemKey, matchKey',
  releaseSupporters: 'itemKey, *fanIds',
  me: 'id',
  twins: 'fanId, score',
  latelyTwins: 'fanId, lately',
  queue: '++id, &[kind+target], [priority+nextAttemptAt+rank]',
  fanMatches: 'fanId',
  matchOwners: 'matchId',
  hidden: 'matchKey',
  following: '[kind+id], kind, *tagIds',
  tags: '++id, &nameKey',
  itemTags: 'itemKey, *tagIds',
};

const golden = () => JSON.parse(readFileSync(GOLDEN, 'utf8'));

/** Items are in the v12 shape: no URLs or defaults, and their bands' hosts stored. */
async function expectSlim(target: DigheadDb): Promise<void> {
  const items = await target.items.toArray();
  expect(items.length).toBeGreaterThan(0);
  expect(items.filter((item) => 'url' in item || 'fetchedAt' in item)).toEqual([]);
  expect(items.filter((item) => item.albumKey === null || item.tags?.length === 0)).toEqual([]);
  expect(await target.bands.count()).toBeGreaterThan(0);
}

/** Ownership rows written by v12 leave out `source: 'collection'`; migrated ones keep it. */
const collectionRows = (target: DigheadDb) =>
  target.ownership.filter((row) => row.source === 'collection').count();
const v11Backup = () => new Blob([readFileSync(V11_BACKUP)]);
const outputsOf = async (target: DigheadDb) =>
  JSON.parse(JSON.stringify(await collectOutputs(target)));

let db: DigheadDb;
let name: string;

beforeEach(() => {
  name = `golden-${crypto.randomUUID()}`;
  db = new DigheadDb(name);
});

afterEach(async () => {
  await db.delete();
});

it('every recommender answers as recorded', async () => {
  await db.open();
  await buildScenario(db);
  await expectSlim(db);
  expect(await collectionRows(db)).toBe(0);
  const outputs = await outputsOf(db);
  if (process.env.UPDATE_GOLDEN || !existsSync(GOLDEN)) {
    writeFileSync(GOLDEN, `${JSON.stringify(outputs, null, 1)}\n`);
  }
  expect(outputs).toEqual(golden());
});

it('answers the same after Dexie upgrades a v11 database', async () => {
  const old = new Dexie(name);
  old.version(11).stores(V11_STORES);
  ensureFileReader();
  await importInto(old, v11Backup(), { acceptNameDiff: true });
  old.close();

  await db.open();
  expect(db.verno).toBe(18);
  await expectSlim(db);
  expect(await collectionRows(db)).toBeGreaterThan(0);
  expect(await outputsOf(db)).toEqual(golden());
});

it('answers the same after importing a v11 backup', async () => {
  await db.open();
  await importDatabase(db, v11Backup(), memorySnapshot().store, async () => undefined);
  await expectSlim(db);
  expect(await outputsOf(db)).toEqual(golden());
});

it('answers the same after a gzipped round trip', async () => {
  await db.open();
  await buildScenario(db);
  const { file } = await exportDatabase(db);
  const copy = new DigheadDb(`${name}-copy`);
  await copy.open();
  await importDatabase(copy, file, memorySnapshot().store, async () => undefined);
  expect(await outputsOf(copy)).toEqual(golden());
  await copy.delete();
});

it.skipIf(!process.env.UPDATE_GOLDEN)('saves the scenario as a backup fixture', async () => {
  await db.open();
  await buildScenario(db);
  const { file } = await exportDatabase(db);
  writeFileSync(
    join(import.meta.dirname, `v${db.verno}-backup.json`),
    await (await readBackup(file)).text(),
  );
});
