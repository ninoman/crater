// Message handlers for full-database backup. The file travels through staging (shared/backupStaging).

import { exportDatabase, importDatabase, type CraterDb, type SnapshotStore } from '../db';
import {
  discardStagedFile,
  hasStagedFile,
  readStagedFile,
  stageFile,
} from '../shared/backupStaging';
import type { MessageHandlers } from '../shared/messages';
import { chromeImportStateStore } from './importState';
import { keepAliveWhile } from './keepAlive';
import { refreshCrateMates } from './recommend';
import { resetScanDataAfterImport, whileScannerPausedForImport } from './scanner';

export type BackupHandlers = Pick<
  MessageHandlers,
  'exportBackup' | 'importBackup' | 'getImportNotice' | 'dismissImportNotice'
>;

export const opfsSnapshot: SnapshotStore = {
  save: (file) => stageFile('snapshot', file),
  load: () => readStagedFile('snapshot'),
  exists: () => hasStagedFile('snapshot'),
  discard: () => discardStagedFile('snapshot'),
};

export function backupHandlers(db: CraterDb): BackupHandlers {
  return {
    exportBackup: async () => {
      const { file, summary } = await keepAliveWhile(exportDatabase(db));
      await stageFile('export', file);
      return summary;
    },
    importBackup: async () => {
      try {
        return await whileScannerPausedForImport(async () => {
          const summary = await keepAliveWhile(
            importDatabase(db, await readStagedFile('import'), opfsSnapshot, (phase) =>
              chromeImportStateStore.save({ phase, notice: null }),
            ),
          );
          await resetScanDataAfterImport();
          return summary;
        });
      } finally {
        await discardStagedFile('import');
        refreshCrateMates();
      }
    },
    getImportNotice: async () => (await chromeImportStateStore.load()).notice,
    dismissImportNotice: async () => {
      await chromeImportStateStore.save({ notice: null });
      return null;
    },
  };
}
