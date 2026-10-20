// Whole-database export and import through dexie-export-import, which streams a Blob instead of
// building one string (a heavy user's database is gigabytes; decisions §10).

import { exportDB, importInto, peakImportFile } from 'dexie-export-import';
import {
  assertRestorableVersion,
  parseBackupMeta,
  summarizeBackup,
  type BackupMeta,
  type BackupSummary,
} from '../shared/backupFile';
import type { DigheadDb } from './schema';

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
const READ_ONLY = { acceptNameDiff: true, noTransaction: true } as const;

/**
 * Replaces every table with the file's rows. The file is read end to end first without writing
 * anything, so a corrupt or foreign file leaves the database as it was.
 *
 * The write itself isn't one transaction: a service worker can't read the file synchronously, so
 * an IndexedDB transaction would close between chunks (decisions §10).
 */
export async function importDatabase(db: DigheadDb, file: Blob): Promise<BackupSummary> {
  ensureFileReader();
  const meta = parseBackupMeta(await peakImportFile(file).catch(() => null));
  assertRestorableVersion(meta.data.databaseVersion, db.verno);
  const exported = new Set(meta.data.tables.map((table) => table.name));
  if (db.tables.some((table) => !exported.has(table.name))) {
    throw new Error("That backup is missing some of Dighead's tables.");
  }
  await verifyRows(db, file, meta);
  await Promise.all(db.tables.map((table) => table.clear()));
  await importInto(db, file, READ_ONLY);
  return summarizeBackup(meta);
}
