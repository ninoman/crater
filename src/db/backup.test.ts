import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { memorySnapshot } from '../../tests/memorySnapshot';
import { exportDatabase, importDatabase } from './backup';
import { readBackup } from './gzip';
import { clearAllData, getItemList } from './repo';
import { DigheadDb } from './schema';

const noPhase = async () => {};

/** An exported backup's JSON, unzipped. */
const jsonText = async (file: Blob) => (await readBackup(file)).text();

let db: DigheadDb;

async function seed(target: DigheadDb): Promise<void> {
  await target.fans.put({
    fanId: 1,
    username: 'a',
    name: 'A',
    imageId: null,
    collectionSize: 2,
    scannedItems: 2,
    collectionFetchedAt: 10,
    status: 'done',
    lastSeenAt: 10,
  });
  await target.ownership.put({
    fanId: 1,
    itemKey: 'a1',
    matchKey: 'a1',
    source: 'collection',
    addedAt: null,
  });
  await target.fanMatches.put({
    fanId: 1,
    matchIds: new Float64Array([1]),
    trackIds: new Float64Array(),
    partialIds: new Float64Array(),
    matchTimes: new Float64Array([0]),
  });
  await target.me.put({ id: 'self', fanId: 1, username: 'a', syncedAt: 5 });
  await target.tags.put({ id: 7, name: 'Ambient', nameKey: 'ambient' });
  await target.following.put({
    kind: 'band',
    id: 9,
    name: 'B',
    url: 'https://b.bandcamp.com',
    imageId: null,
    location: null,
    followedAt: 1,
    tagIds: [7],
    unfollowed: false,
  });
  await target.queue.put({
    kind: 'fan',
    target: '1',
    priority: 1,
    rank: 0,
    attempts: 0,
    nextAttemptAt: 0,
    cursor: null,
  });
}

async function snapshot(target: DigheadDb) {
  return Object.fromEntries(
    await Promise.all(target.tables.map(async (t) => [t.name, await t.toArray()] as const)),
  );
}

beforeEach(async () => {
  db = new DigheadDb('backup-test');
  await db.open();
});

afterEach(async () => {
  db.close();
  await db.delete();
});

describe('backup round trip', () => {
  it('restores every table after a clear', async () => {
    await seed(db);
    const before = await snapshot(db);
    const { file, summary } = await exportDatabase(db);
    expect(summary).toEqual({ tables: db.tables.length, rows: 7 });

    await clearAllData(db);
    const restored = await importDatabase(db, file, memorySnapshot().store, noPhase);

    expect(restored).toEqual(summary);
    expect(await snapshot(db)).toEqual(before);
  });

  it('replaces rows that are not in the file', async () => {
    await seed(db);
    const { file } = await exportDatabase(db);
    await db.tags.put({ id: 8, name: 'Extra', nameKey: 'extra' });

    await importDatabase(db, file, memorySnapshot().store, noPhase);

    expect(await db.tags.toArray()).toEqual([{ id: 7, name: 'Ambient', nameKey: 'ambient' }]);
  });
});

describe('import phases', () => {
  it('walks snapshotting, writing, cleanup and clears', async () => {
    await seed(db);
    const { file } = await exportDatabase(db);
    const phases: unknown[] = [];

    await importDatabase(db, file, memorySnapshot().store, async (phase) => {
      phases.push(phase);
    });

    expect(phases).toEqual(['snapshotting', 'writing', 'cleanup', null]);
  });
});

describe('older backups', () => {
  it('imports a v5 file and rebuilds its fanMatches track lists', async () => {
    await seed(db);
    await db.ownership.put({
      fanId: 1,
      itemKey: 't4',
      matchKey: 'a3',
      source: 'collection',
      addedAt: null,
    });
    const { file } = await exportDatabase(db);
    const json = JSON.parse(await jsonText(file));
    json.data.databaseVersion = 5;
    for (const table of json.data.data) {
      if (table.tableName !== 'fanMatches') continue;
      for (const row of table.rows) {
        delete row.trackIds;
        delete row.partialIds;
        delete row.matchTimes;
      }
    }

    await importDatabase(db, new Blob([JSON.stringify(json)]), memorySnapshot().store, noPhase);

    expect(await db.fanMatches.get(1)).toEqual({
      fanId: 1,
      matchIds: new Float64Array([1, 3]),
      trackIds: new Float64Array([-4]),
      partialIds: new Float64Array([3]),
      matchTimes: new Float64Array([0, 0]),
    });
  });

  it('imports a v6 file without the lately table, adding purchase times', async () => {
    await seed(db);
    await db.ownership.put({
      fanId: 1,
      itemKey: 'a2',
      matchKey: 'a2',
      source: 'collection',
      addedAt: 400,
    });
    const { file } = await exportDatabase(db);
    const json = JSON.parse(await jsonText(file));
    json.data.databaseVersion = 6;
    json.data.tables = json.data.tables.filter(
      (t: { name: string }) => t.name !== 'latelyCrateMates',
    );
    json.data.data = json.data.data.filter(
      (t: { tableName: string }) => t.tableName !== 'latelyCrateMates',
    );
    for (const table of json.data.data) {
      if (table.tableName !== 'fanMatches') continue;
      for (const row of table.rows) delete row.matchTimes;
    }
    await clearAllData(db);

    await importDatabase(db, new Blob([JSON.stringify(json)]), memorySnapshot().store, noPhase);

    expect(await db.fanMatches.get(1)).toEqual({
      fanId: 1,
      matchIds: Float64Array.from([1, 2]),
      trackIds: new Float64Array(),
      partialIds: new Float64Array(),
      matchTimes: Float64Array.from([0, 400]),
    });
    expect(await db.tags.count()).toBe(1);
  });

  it('imports a v7 file, ranking its jobs and staging fan cursors', async () => {
    await seed(db);
    const { file } = await exportDatabase(db);
    const json = JSON.parse(await jsonText(file));
    json.data.databaseVersion = 7;
    for (const table of json.data.data) {
      if (table.tableName !== 'queue') continue;
      for (const row of table.rows) {
        delete row.rank;
        row.cursor = { token: 't', scanned: 100 };
      }
    }
    await clearAllData(db);

    await importDatabase(db, new Blob([JSON.stringify(json)]), memorySnapshot().store, noPhase);

    expect(await db.queue.toArray()).toEqual([
      expect.objectContaining({
        rank: 0,
        via: null,
        cursor: { stage: 'full', token: 't', scanned: 100 },
      }),
    ]);
  });

  it('imports a v9 file, flagging compilations from the artist and title', async () => {
    const item = { albumKey: null, bandId: 1, label: null, labelId: null, url: 'u', artId: null };
    const record = { ...item, tags: [], supporterCount: null, compilation: false, fetchedAt: 0 };
    await db.items.bulkPut([
      { ...record, itemKey: 'a1', title: 'Benefit', artist: 'Various Artists' },
      { ...record, itemKey: 'a2', title: 'LP', artist: 'Someone' },
    ]);
    const { file } = await exportDatabase(db);
    const json = JSON.parse(await jsonText(file));
    json.data.databaseVersion = 9;
    for (const table of json.data.data) {
      if (table.tableName !== 'items') continue;
      for (const row of table.rows) delete row.compilation;
    }
    await clearAllData(db);

    await importDatabase(db, new Blob([JSON.stringify(json)]), memorySnapshot().store, noPhase);

    const items = await getItemList(db, ['a1', 'a2']);
    expect(items.map((i) => [i?.itemKey, i?.compilation])).toEqual([
      ['a1', true],
      ['a2', false],
    ]);
  });
});

describe('refused files', () => {
  it('refuses a newer schema version and keeps the data', async () => {
    await seed(db);
    const before = await snapshot(db);
    const { file } = await exportDatabase(db);
    const json = JSON.parse(await jsonText(file));
    json.data.databaseVersion = db.verno + 1;

    await expect(
      importDatabase(db, new Blob([JSON.stringify(json)]), memorySnapshot().store, noPhase),
    ).rejects.toThrow('newer version');
    expect(await snapshot(db)).toEqual(before);
  });

  it('refuses a backup older than any build that made backups', async () => {
    await seed(db);
    const { file } = await exportDatabase(db);
    const json = JSON.parse(await jsonText(file));
    json.data.databaseVersion = 4;

    await expect(
      importDatabase(db, new Blob([JSON.stringify(json)]), memorySnapshot().store, noPhase),
    ).rejects.toThrow('older version');
  });

  it('changes nothing for a file cut off mid-rows', async () => {
    await seed(db);
    const before = await snapshot(db);
    const { file } = await exportDatabase(db);
    const text = await jsonText(file);

    await expect(
      importDatabase(
        db,
        new Blob([text.slice(0, Math.floor(text.length * 0.8))]),
        memorySnapshot().store,
        noPhase,
      ),
    ).rejects.toThrow('damaged');
    expect(await snapshot(db)).toEqual(before);
  });

  it('changes nothing for a file that is not a backup', async () => {
    await seed(db);
    const before = await snapshot(db);

    await expect(
      importDatabase(db, new Blob(['{"tags":[]}']), memorySnapshot().store, noPhase),
    ).rejects.toThrow("isn't a Dighead backup");
    await expect(
      importDatabase(db, new Blob(['not json']), memorySnapshot().store, noPhase),
    ).rejects.toThrow();
    expect(await snapshot(db)).toEqual(before);
  });
});

describe('all or nothing', () => {
  /** Passes the header and the read-through, then fails mid-write on the unique tag name. */
  async function failingWriteFile(): Promise<Blob> {
    const other = new DigheadDb('backup-source');
    await other.open();
    await other.tags.bulkPut([
      { id: 1, name: 'One', nameKey: 'dup' },
      { id: 2, name: 'Two', nameKey: 'dup2' },
    ]);
    await other.fans.put({
      fanId: 50,
      username: 'z',
      name: 'Z',
      imageId: null,
      collectionSize: null,
      scannedItems: 0,
      collectionFetchedAt: null,
      status: 'queued',
      lastSeenAt: 1,
    });
    const text = (await jsonText((await exportDatabase(other)).file)).replace('"dup2"', '"dup"');
    other.close();
    await other.delete();
    return new Blob([text]);
  }

  it('restores the old data when the write fails part-way', async () => {
    await seed(db);
    const before = await snapshot(db);
    const { store, held } = memorySnapshot();
    const phases: unknown[] = [];

    await expect(
      importDatabase(db, await failingWriteFile(), store, async (phase) => {
        phases.push(phase);
      }),
    ).rejects.toThrow('Your previous data was restored');

    expect(await snapshot(db)).toEqual(before);
    expect(held()).toBeNull();
    expect(phases).toEqual(['snapshotting', 'writing', null]);
  });

  it('keeps the snapshot when restoring fails too', async () => {
    await seed(db);
    const { store, held } = memorySnapshot({
      load: async () => {
        throw new Error('gone');
      },
    });

    await expect(importDatabase(db, await failingWriteFile(), store, noPhase)).rejects.toThrow(
      "couldn't be restored automatically",
    );
    expect(held()).not.toBeNull();
  });

  it('touches nothing when the safety copy cannot be saved', async () => {
    await seed(db);
    const { file } = await exportDatabase(db);
    const before = await snapshot(db);
    await db.tags.put({ id: 8, name: 'Extra', nameKey: 'extra' });
    const withExtra = await snapshot(db);
    const { store } = memorySnapshot({
      save: async () => {
        throw new Error('disk full');
      },
    });

    await expect(importDatabase(db, file, store, noPhase)).rejects.toThrow('nothing was changed');
    expect(await snapshot(db)).toEqual(withExtra);
    expect(withExtra).not.toEqual(before);
  });
});
