// Message handlers for full-database backup. The file travels through staging (shared/backupStaging).

import { exportDatabase, importDatabase, type DigheadDb, type SnapshotStore } from '../db';
import { discardStagedFile, readStagedFile, stageFile } from '../shared/backupStaging';
import type { MessageHandlers } from '../shared/messages';
import { refreshTwins } from './recommend';
import { resetScanDataAfterImport, whileScannerPausedForImport } from './scanner';

export type BackupHandlers = Pick<MessageHandlers, 'exportBackup' | 'importBackup'>;

const opfsSnapshot: SnapshotStore = {
  save: (file) => stageFile('snapshot', file),
  load: () => readStagedFile('snapshot'),
  discard: () => discardStagedFile('snapshot'),
};

export function backupHandlers(db: DigheadDb): BackupHandlers {
  return {
    exportBackup: async () => {
      const { file, summary } = await exportDatabase(db);
      await stageFile('export', file);
      return summary;
    },
    importBackup: async () => {
      try {
        return await whileScannerPausedForImport(async () => {
          const summary = await importDatabase(db, await readStagedFile('import'), opfsSnapshot);
          await resetScanDataAfterImport();
          return summary;
        });
      } finally {
        await discardStagedFile('import');
        refreshTwins();
      }
    },
  };
}
