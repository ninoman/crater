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
import { gzip, readBackup } from './gzip';
import { renameTables } from './renameTables';
import {
  blankLately,
  type DigheadDb,
  fillBandLocations,
  flagCompilation,
  rebuildFanMatchLists,
  slimToV12,
  TABLES_ADDED,
  TABLES_RENAMED,
  upgradeHide,
  upgradeJobToV8,
} from './schema';

/** The library reads blob slices with FileReader, which service workers don't have. */
export function ensureFileReader(): void {
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

/** The whole database as a gzipped backup file. */
export async function exportDatabase(
  db: DigheadDb,
): Promise<{ file: Blob; summary: BackupSummary }> {
  ensureFileReader();
  const json = await exportDB(db, { prettyJson: false });
  const meta = parseBackupMeta(await peakImportFile(json));
  return { file: await gzip(json), summary: summarizeBackup(meta) };
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
// `hides` took over `hidden` with a new primary key in v14 (readJson renames it, upgradeRows
// reshapes its rows), so the key the file names may differ.
const READ_ONLY = {
  acceptNameDiff: true,
  acceptVersionDiff: true,
  acceptChangedPrimaryKey: true,
  noTransaction: true,
} as const;

/**
 * Rows that can't be written in their old shape, brought up to date as they're read. Only hides
 * so far (v14): their old rows lack the new primary key, so migrateRows would be too late.
 */
function upgradeRows(table: string, value: unknown): { value: unknown } {
  return {
    value: table === 'hides' ? upgradeHide(value as Parameters<typeof upgradeHide>[0]) : value,
  };
}

/** Brings rows written by an older schema up to this one, as its Dexie upgrades would have. */
async function migrateRows(db: DigheadDb, fromVersion: number): Promise<void> {
  // v6 added track lists and v7 purchase times to fanMatches: one rebuild covers both.
  if (fromVersion < 7) {
    await db.transaction('rw', [db.fanMatches, db.ownership], () =>
      rebuildFanMatchLists(db.fanMatches, db.ownership),
    );
    await db.crateMates.toCollection().modify(blankLately);
  }
  // v8 ranked queued jobs and staged fan scans.
  if (fromVersion < 8) await db.queue.toCollection().modify(upgradeJobToV8);
  // v11 flagged compilations on items.
  if (fromVersion < 11) await db.items.toCollection().modify(flagCompilation);
  // v12 slimmed items and ownership rows (decisions §19).
  if (fromVersion < 12) {
    await db.transaction('rw', [db.items, db.bands], () => slimToV12(db.items, db.bands));
  }
  // v17 added filter facts (decisions §25); only followed bands' locations are already known.
  if (fromVersion < 17) {
    await db.transaction('rw', [db.bands, db.following], () =>
      fillBandLocations(db.bands, db.following),
    );
  }
}

/** A backup's JSON, with tables renamed since it was made under their current names. */
async function readJson(file: Blob): Promise<Blob> {
  const json = await readBackup(file);
  const version = (await peakImportFile(json).catch(() => null))?.data?.databaseVersion;
  if (typeof version !== 'number') return json;
  const renames = Object.entries(TABLES_RENAMED).filter(([, renamed]) => version < renamed.version);
  return renameTables(json, Object.fromEntries(renames.map(([from, { to }]) => [from, to])));
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
  const json = await readJson(file);
  await Promise.all(db.tables.map((table) => table.clear()));
  await importInto(db, json, { ...READ_ONLY, transform: upgradeRows });
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
  backup: Blob,
  snapshot: SnapshotStore,
  onPhase: (phase: ImportPhase | null) => Promise<void>,
): Promise<BackupSummary> {
  ensureFileReader();
  const file = await readJson(backup);
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
