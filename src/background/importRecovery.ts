// Puts the database right after a worker died mid-import, before the scanner or a sync runs.
// A leftover snapshot alone can't say what to do: only the recorded phase can (decisions §10).

import { replaceAll, type CraterDb, type SnapshotStore } from '../db';
import type { ImportNotice } from '../shared/backupFile';
import type { ImportStateStore } from './importState';

async function recover(db: CraterDb, store: ImportStateStore, snapshot: SnapshotStore) {
  const { phase } = await store.load();
  const present = await snapshot.exists();
  switch (phase) {
    case 'snapshotting':
      // The old data was never touched; the snapshot is only partly written.
      await snapshot.discard();
      return 'cancelled';
    case 'cleanup':
      await snapshot.discard();
      return 'completed';
    case 'writing':
      if (!present) return 'restore-failed';
      try {
        await replaceAll(db, await snapshot.load());
      } catch {
        return 'restore-failed';
      }
      await snapshot.discard();
      return 'rolled-back';
    case null:
      // A restore that failed earlier. Reported, not retried, so startup can't loop on it.
      return present ? 'snapshot-left' : null;
  }
}

/**
 * Returns what it did, or null when there was nothing to recover. `clearPause` lifts the
 * scanner's import flag, which a dead worker never cleared.
 */
export async function recoverInterruptedImport(
  db: CraterDb,
  store: ImportStateStore,
  snapshot: SnapshotStore,
  clearPause: () => Promise<void>,
): Promise<ImportNotice | null> {
  const notice = await recover(db, store, snapshot).catch((): ImportNotice => 'restore-failed');
  await store.save(notice ? { phase: null, notice } : { phase: null });
  await clearPause();
  return notice;
}
