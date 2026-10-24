import { useCallback, useState } from 'react';
import { backupFilename, backupSummaryText } from '../shared/backupFile';
import { discardStagedFile, readStagedFile, stageFile } from '../shared/backupStaging';
import { sendMessage } from '../shared/messages';
import { saveFile } from './saveFile';

export type DatabaseBackupStatus =
  | { state: 'idle' }
  | { state: 'working'; action: 'export' | 'import' }
  | { state: 'exported' }
  | { state: 'imported'; summary: string }
  | { state: 'error'; error: string };

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Export and import of the whole database as one JSON file. */
export function useDatabaseBackup() {
  const [status, setStatus] = useState<DatabaseBackupStatus>({ state: 'idle' });

  const exportBackup = useCallback(async () => {
    setStatus({ state: 'working', action: 'export' });
    try {
      await sendMessage('exportBackup', {});
      saveFile(backupFilename(new Date()), await readStagedFile('export'));
      setStatus({ state: 'exported' });
    } catch (error) {
      setStatus({ state: 'error', error: errorText(error) });
    }
    // A revoked blob URL may still be mid-save, but the OPFS entry only unlinks on last close.
    await discardStagedFile('export');
  }, []);

  const importBackup = useCallback(async (file: File) => {
    setStatus({ state: 'working', action: 'import' });
    try {
      await stageFile('import', file);
      const summary = await sendMessage('importBackup', {});
      setStatus({ state: 'imported', summary: backupSummaryText(summary) });
    } catch (error) {
      setStatus({ state: 'error', error: errorText(error) });
    }
  }, []);

  return { status, exportBackup, importBackup };
}
