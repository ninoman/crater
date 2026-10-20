// Message handlers for full-database backup. The file travels through staging (shared/backupStaging).

import { exportDatabase, importDatabase, type DigheadDb } from '../db';
import { discardStagedFile, readStagedFile, stageFile } from '../shared/backupStaging';
import type { MessageHandlers } from '../shared/messages';
import { refreshTwins } from './recommend';
import { resetScanDataAfterImport } from './scanner';

export type BackupHandlers = Pick<MessageHandlers, 'exportBackup' | 'importBackup'>;

export function backupHandlers(db: DigheadDb): BackupHandlers {
  return {
    exportBackup: async () => {
      const { file, summary } = await exportDatabase(db);
      await stageFile('export', file);
      return summary;
    },
    importBackup: async () => {
      try {
        const summary = await importDatabase(db, await readStagedFile('import'));
        await resetScanDataAfterImport();
        refreshTwins();
        return summary;
      } finally {
        await discardStagedFile('import');
      }
    },
  };
}
