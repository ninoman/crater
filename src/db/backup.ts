// Whole-database export and import through dexie-export-import, which streams a Blob instead of
// building one string (a heavy user's database is gigabytes; decisions §10).

import { exportDB, importInto, peakImportFile } from 'dexie-export-import';
import {
  assertRestorableVersion,
  type ImportPhase,
  parseBackupMeta,
  summarizeBackup,
  type BackupMeta,
  type BackupSummary,
} from '../shared/backupFile';
import {
  blankLately,
  type DigheadDb,
  flagCompilation,
  rebuildFanMatchLists,
  TABLES_ADDED,
  upgradeJobToV8,
} from './schema';

/** The library reads blob slices with FileReader, which service workers don't have. */
function ensureFileReader(): void {
  if ('FileReader' in globalThis) return;
  class BlobFileReader {
    result: ArrayBuffer | null = null;
    error: unknown = null;
    onload: ((event: { target: BlobFileReader }) => void) | null = null;
    onerror: ((event: { target: BlobFileReader }) => void) | null = null;
    onabort: (() => void) | null = null;
    readAsArrayBuffer(blob: Blob): void {
      blob.arrayBuffer().then(
        (buffer) => {
          this.result = buffer;
          this.onload?.({ target: this });
        },
        (error: unknown) => {
          this.error = error;
          this.onerror?.({ target: this });
        },
      );
    }
  }
  Object.assign(globalThis, { FileReader: BlobFileReader });
}

export async function exportDatabase(
  db: DigheadDb,
): Promise<{ file: Blob; summary: BackupSummary }> {
  ensureFileReader();
  const file = await exportDB(db, { prettyJson: false });
  const meta = parseBackupMeta(await peakImportFile(file));
  return { file, summary: summarizeBackup(meta) };
}

/** Reads every row without writing; the library doesn't notice a file cut short, so rows are counted. */
async function verifyRows(db: DigheadDb, file: Blob, meta: BackupMeta): Promise<void> {
  const seen = new Map<string, number>();
  try {
    await importInto(db, file, {
      ...READ_ONLY,
      filter: (table) => {
        seen.set(table, (seen.get(table) ?? 0) + 1);
        return false;
      },
    });
  } catch {
    throw new Error(DAMAGED);
  }
  if (meta.data.tables.some((table) => (seen.get(table.name) ?? 0) !== table.rowCount)) {
    throw new Error(DAMAGED);
  }
}

const DAMAGED = 'That backup file is damaged. Nothing was changed.';
// The version is checked by assertRestorableVersion, and older rows migrated after writing.
const READ_ONLY = { acceptNameDiff: true, acceptVersionDiff: true, noTransaction: true } as const;

/** Brings rows written by an older schema up to this one, as its Dexie upgrades would have. */
async function migrateRows(db: DigheadDb, fromVersion: number): Promise<void> {
  // v6 added track lists and v7 purchase times to fanMatches: one rebuild covers both.
  if (fromVersion < 7) {
    await db.transaction('rw', [db.fanMatches, db.ownership], () =>
      rebuildFanMatchLists(db.fanMatches, db.ownership),
    );
    await db.twins.toCollection().modify(blankLately);
  }
  // v8 ranked queued jobs and staged fan scans.
  if (fromVersion < 8) await db.queue.toCollection().modify(upgradeJobToV8);
  // v10 flagged compilations on items.
  if (fromVersion < 10) await db.items.toCollection().modify(flagCompilation);
}

/** Where the safety copy of the current data waits while an import runs. */
export interface SnapshotStore {
  save(file: Blob): Promise<void>;
  load(): Promise<Blob>;
  exists(): Promise<boolean>;
  discard(): Promise<void>;
}

/** Clears every table and writes the file's rows. Also how a snapshot is put back. */
export async function replaceAll(db: DigheadDb, file: Blob): Promise<void> {
  ensureFileReader();
  await Promise.all(db.tables.map((table) => table.clear()));
  await importInto(db, file, READ_ONLY);
}

/**
 * Replaces every table with the file's rows, all or nothing:
 * 1. the file is read end to end without writing, so a corrupt or foreign file changes nothing;
 * 2. the current data is exported to `snapshot`, and if that fails nothing has been touched;
 * 3. tables are cleared and written, and if that fails the snapshot is written back.
 *
 * `onPhase` records how far it got, so a worker killed midway can be recovered (importRecovery).
 *
 * A single IndexedDB transaction isn't possible here: a service worker can't read the file
 * synchronously, so a transaction would close between chunks (decisions §10).
 */
export async function importDatabase(
  db: DigheadDb,
  file: Blob,
  snapshot: SnapshotStore,
  onPhase: (phase: ImportPhase | null) => Promise<void>,
): Promise<BackupSummary> {
  ensureFileReader();
  const meta = parseBackupMeta(await peakImportFile(file).catch(() => null));
  const fileVersion = meta.data.databaseVersion;
  assertRestorableVersion(fileVersion, db.verno);
  const exported = new Set(meta.data.tables.map((table) => table.name));
  const expected = db.tables.filter((table) => (TABLES_ADDED[table.name] ?? 0) <= fileVersion);
  if (expected.some((table) => !exported.has(table.name))) {
    throw new Error("That backup is missing some of Dighead's tables.");
  }
  await verifyRows(db, file, meta);

  await onPhase('snapshotting');
  try {
    await snapshot.save((await exportDatabase(db)).file);
  } catch (error) {
    await snapshot.discard().catch(() => undefined);
    await onPhase(null);
    throw new Error(
      `Couldn't save a safety copy of your data first, so nothing was changed. ${reason(error)}`,
    );
  }

  await onPhase('writing');
  try {
    await replaceAll(db, file);
    await migrateRows(db, fileVersion);
  } catch (error) {
    try {
      await replaceAll(db, await snapshot.load());
    } catch {
      // Keep the snapshot: it's the only copy left of the old data.
      await onPhase(null);
      throw new Error(
        `The import failed (${reason(error)}) and the old data couldn't be restored automatically.`,
      );
    }
    await snapshot.discard().catch(() => undefined);
    await onPhase(null);
    throw new Error(`The import failed (${reason(error)}). Your previous data was restored.`);
  }
  await onPhase('cleanup');
  await snapshot.discard().catch(() => undefined);
  await onPhase(null);
  return summarizeBackup(meta);
}

function reason(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
