import type { SnapshotStore } from '../src/db/backup';

/** An in-memory stand-in for the OPFS snapshot file. */
export function memorySnapshot(
  overrides: Partial<SnapshotStore> = {},
  initial: Blob | null = null,
) {
  let held: Blob | null = initial;
  const store: SnapshotStore = {
    save: async (file) => {
      held = file;
    },
    load: async () => {
      if (!held) throw new Error('no snapshot');
      return held;
    },
    exists: async () => held !== null,
    discard: async () => {
      held = null;
    },
    ...overrides,
  };
  return { store, held: () => held };
}
