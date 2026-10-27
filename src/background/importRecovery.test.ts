import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { memorySnapshot } from '../../tests/memorySnapshot';
import { exportDatabase, CraterDb } from '../db';
import type { ImportPhase } from '../shared/backupFile';
import { recoverInterruptedImport } from './importRecovery';
import type { ImportState, ImportStateStore } from './importState';

let db: CraterDb;

function memoryState(phase: ImportPhase | null) {
  let state: ImportState = { phase, notice: null };
  const store: ImportStateStore = {
    load: async () => state,
    save: async (patch) => {
      state = { ...state, ...patch };
    },
  };
  return { store, state: () => state };
}

const tag = (id: number, name: string) => ({ id, name, nameKey: name.toLowerCase() });

/** A db holding "new" data, plus a snapshot of the "old" data. */
async function crashedMidWrite() {
  await db.tags.put(tag(1, 'Old'));
  const snapshotFile = (await exportDatabase(db)).file;
  await db.tags.clear();
  await db.tags.put(tag(2, 'Half'));
  return snapshotFile;
}

async function run(phase: ImportPhase | null, snapshot: ReturnType<typeof memorySnapshot>) {
  const { store, state } = memoryState(phase);
  let cleared = 0;
  const notice = await recoverInterruptedImport(db, store, snapshot.store, async () => {
    cleared += 1;
  });
  return { notice, state: state(), cleared };
}

beforeEach(async () => {
  db = new CraterDb('recovery-test');
  await db.open();
});

afterEach(async () => {
  db.close();
  await db.delete();
});

describe('recoverInterruptedImport', () => {
  it('restores the snapshot when the worker died while writing', async () => {
    const snapshot = memorySnapshot({}, await crashedMidWrite());

    const result = await run('writing', snapshot);

    expect(result.notice).toBe('rolled-back');
    expect((await db.tags.toArray()).map((t) => t.name)).toEqual(['Old']);
    expect(snapshot.held()).toBeNull();
    expect(result.state.phase).toBeNull();
    expect(result.cleared).toBe(1);
  });

  it('keeps the snapshot when the restore fails, and does not retry on the next start', async () => {
    const snapshot = memorySnapshot(
      {
        load: async () => {
          throw new Error('unreadable');
        },
      },
      new Blob(['x']),
    );

    const first = await run('writing', snapshot);
    expect(first.notice).toBe('restore-failed');
    expect(snapshot.held()).not.toBeNull();

    const second = await run(first.state.phase, snapshot);
    expect(second.notice).toBe('snapshot-left');
    expect(snapshot.held()).not.toBeNull();
  });

  it('reports a failed restore when writing died with no snapshot', async () => {
    expect((await run('writing', memorySnapshot())).notice).toBe('restore-failed');
  });

  it('only drops the partial snapshot when the worker died while snapshotting', async () => {
    await db.tags.put(tag(1, 'Old'));
    const snapshot = memorySnapshot({}, new Blob(['{"partial']));

    const result = await run('snapshotting', snapshot);

    expect(result.notice).toBe('cancelled');
    expect((await db.tags.toArray()).map((t) => t.name)).toEqual(['Old']);
    expect(snapshot.held()).toBeNull();
  });

  it('keeps a finished import and drops the snapshot in cleanup', async () => {
    await db.tags.put(tag(2, 'New'));
    const snapshot = memorySnapshot({}, new Blob(['old']));

    const result = await run('cleanup', snapshot);

    expect(result.notice).toBe('completed');
    expect((await db.tags.toArray()).map((t) => t.name)).toEqual(['New']);
    expect(snapshot.held()).toBeNull();
  });

  it('does nothing without a phase or a snapshot, but still lifts the pause', async () => {
    const result = await run(null, memorySnapshot());
    expect(result.notice).toBeNull();
    expect(result.cleared).toBe(1);
  });
});
