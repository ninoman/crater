import { describe, expect, it } from 'vitest';
import {
  assertRestorableVersion,
  backupFilename,
  backupSummaryText,
  parseBackupMeta,
  summarizeBackup,
} from './backupFile';

const meta = {
  formatName: 'dexie',
  formatVersion: 1,
  data: {
    databaseName: 'dighead',
    databaseVersion: 5,
    tables: [
      { name: 'fans', schema: 'fanId', rowCount: 1200 },
      { name: 'tags', schema: '++id', rowCount: 1 },
    ],
  },
};

describe('backupFilename', () => {
  it('carries the UTC date', () => {
    expect(backupFilename(new Date('2026-10-21T23:59:00Z'))).toBe(
      'dighead-backup-2026-10-21.json.gz',
    );
  });
});

describe('summaries', () => {
  it('totals rows and tables', () => {
    expect(summarizeBackup(parseBackupMeta(meta))).toEqual({ tables: 2, rows: 1201 });
  });

  it('words the summary with plurals', () => {
    expect(backupSummaryText({ tables: 2, rows: 1201 })).toBe('Restored 1,201 rows in 2 tables');
    expect(backupSummaryText({ tables: 1, rows: 1 })).toBe('Restored 1 row in 1 table');
  });
});

describe('parseBackupMeta', () => {
  it('refuses anything that is not a dexie export header', () => {
    expect(() => parseBackupMeta({ fans: [] })).toThrow("isn't a Dighead backup");
    expect(() => parseBackupMeta(null)).toThrow("isn't a Dighead backup");
  });
});

describe('assertRestorableVersion', () => {
  it('accepts the build version, and older ones back to the oldest restorable', () => {
    expect(() => assertRestorableVersion(7, 7)).not.toThrow();
    expect(() => assertRestorableVersion(6, 7)).not.toThrow();
    expect(() => assertRestorableVersion(5, 7)).not.toThrow();
  });

  it('refuses a newer file with an update hint', () => {
    expect(() => assertRestorableVersion(8, 7)).toThrow('newer version');
  });

  it('refuses a file older than any migration covers', () => {
    expect(() => assertRestorableVersion(4, 7)).toThrow('older version');
  });
});
