import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { exportDatabase, importDatabase, type SnapshotStore } from './backup';
import { clearAllData } from './repo';
import { DigheadDb } from './schema';

let db: DigheadDb;

function memorySnapshot(overrides: Partial<SnapshotStore> = {}) {
  let held: Blob | null = null;
  const store: SnapshotStore = {
    save: async (file) => {
      held = file;
    },
    load: async () => {
      if (!held) throw new Error('no snapshot');
      return held;
    },
    discard: async () => {
      held = null;
    },
    ...overrides,
  };
  return { store, held: () => held };
}

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
  await target.fanMatches.put({ fanId: 1, matchIds: new Float64Array([1, 2, 3]) });
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
    const restored = await importDatabase(db, file, memorySnapshot().store);

    expect(restored).toEqual(summary);
    expect(await snapshot(db)).toEqual(before);
  });

  it('replaces rows that are not in the file', async () => {
    await seed(db);
    const { file } = await exportDatabase(db);
    await db.tags.put({ id: 8, name: 'Extra', nameKey: 'extra' });

    await importDatabase(db, file, memorySnapshot().store);

    expect(await db.tags.toArray()).toEqual([{ id: 7, name: 'Ambient', nameKey: 'ambient' }]);
  });
});

describe('refused files', () => {
  it('refuses a newer schema version and keeps the data', async () => {
    await seed(db);
    const before = await snapshot(db);
    const { file } = await exportDatabase(db);
    const json = JSON.parse(await file.text());
    json.data.databaseVersion = db.verno + 1;

    await expect(
      importDatabase(db, new Blob([JSON.stringify(json)]), memorySnapshot().store),
    ).rejects.toThrow('newer version');
    expect(await snapshot(db)).toEqual(before);
  });

  it('changes nothing for a file cut off mid-rows', async () => {
    await seed(db);
    const before = await snapshot(db);
    const { file } = await exportDatabase(db);
    const text = await file.text();

    await expect(
      importDatabase(
        db,
        new Blob([text.slice(0, Math.floor(text.length * 0.8))]),
        memorySnapshot().store,
      ),
    ).rejects.toThrow('damaged');
    expect(await snapshot(db)).toEqual(before);
  });

  it('changes nothing for a file that is not a backup', async () => {
    await seed(db);
    const before = await snapshot(db);

    await expect(
      importDatabase(db, new Blob(['{"tags":[]}']), memorySnapshot().store),
    ).rejects.toThrow("isn't a Dighead backup");
    await expect(
      importDatabase(db, new Blob(['not json']), memorySnapshot().store),
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
    const text = (await (await exportDatabase(other)).file.text()).replace('"dup2"', '"dup"');
    other.close();
    await other.delete();
    return new Blob([text]);
  }

  it('restores the old data when the write fails part-way', async () => {
    await seed(db);
    const before = await snapshot(db);
    const { store, held } = memorySnapshot();

    await expect(importDatabase(db, await failingWriteFile(), store)).rejects.toThrow(
      'Your previous data was restored',
    );

    expect(await snapshot(db)).toEqual(before);
    expect(held()).toBeNull();
  });

  it('keeps the snapshot when restoring fails too', async () => {
    await seed(db);
    const { store, held } = memorySnapshot({
      load: async () => {
        throw new Error('gone');
      },
    });

    await expect(importDatabase(db, await failingWriteFile(), store)).rejects.toThrow(
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

    await expect(importDatabase(db, file, store)).rejects.toThrow('nothing was changed');
    expect(await snapshot(db)).toEqual(withExtra);
    expect(withExtra).not.toEqual(before);
  });
});
