// What a full-database backup file must look like, and the pure helpers around it.
// The file itself is dexie-export-import's format (decisions §10); only its header is checked here.

import { z } from 'zod';

/** The header `peakImportFile` reads from the top of the file, before any row is parsed. */
export const backupMetaSchema = z.object({
  formatName: z.literal('dexie'),
  formatVersion: z.literal(1),
  data: z.object({
    databaseName: z.string(),
    databaseVersion: z.number().int().positive(),
    tables: z.array(
      z.object({ name: z.string(), schema: z.string(), rowCount: z.number().int().nonnegative() }),
    ),
  }),
});

export type BackupMeta = z.infer<typeof backupMetaSchema>;

export interface BackupSummary {
  tables: number;
  rows: number;
}

export function backupFilename(date: Date): string {
  return `dighead-backup-${date.toISOString().slice(0, 10)}.json`;
}

export function summarizeBackup(meta: BackupMeta): BackupSummary {
  const { tables } = meta.data;
  return { tables: tables.length, rows: tables.reduce((sum, table) => sum + table.rowCount, 0) };
}

function count(n: number, noun: string): string {
  return `${n.toLocaleString('en-US')} ${noun}${n === 1 ? '' : 's'}`;
}

export function backupSummaryText({ tables, rows }: BackupSummary): string {
  return `Restored ${count(rows, 'row')} in ${count(tables, 'table')}`;
}

/** Reads a file header. Throws a message fit for the user when it isn't a Dighead backup. */
export function parseBackupMeta(json: unknown): BackupMeta {
  const parsed = backupMetaSchema.safeParse(json);
  if (!parsed.success) throw new Error("That file isn't a Dighead backup.");
  return parsed.data;
}

/** Throws unless a backup's schema version is the one this build runs. */
export function assertRestorableVersion(fileVersion: number, buildVersion: number): void {
  if (fileVersion > buildVersion) {
    throw new Error(
      'That backup was made by a newer version of Dighead. Update the extension, then import it again.',
    );
  }
  // No older schema has produced a backup yet; a schema bump that adds one must migrate rows here.
  if (fileVersion < buildVersion) {
    throw new Error('That backup was made by an older version of Dighead and can’t be imported.');
  }
}

/** How far an import got, kept durably so a worker that dies mid-import can be put right. */
export type ImportPhase = 'snapshotting' | 'writing' | 'cleanup';

/** What startup recovery found after an interrupted import. */
export type ImportNotice =
  | 'rolled-back'
  | 'completed'
  | 'cancelled'
  | 'restore-failed'
  | 'snapshot-left';

export function importNoticeText(notice: ImportNotice): string {
  switch (notice) {
    case 'rolled-back':
      return 'An interrupted import was rolled back. Your previous data is back.';
    case 'completed':
      return 'An interrupted import had finished writing, so it was kept.';
    case 'cancelled':
      return 'An interrupted import was cancelled before it changed anything.';
    case 'restore-failed':
      return 'An interrupted import couldn’t be rolled back automatically. Your data may be incomplete; a safety copy was kept.';
    case 'snapshot-left':
      return 'A safety copy from an earlier import is still stored and wasn’t restored.';
  }
}
