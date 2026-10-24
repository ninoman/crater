import { useCallback, useState } from 'react';
import { sendMessage } from '../shared/messages';
import { saveFile } from './saveFile';
import { importSummaryText, readTagBackup, tagBackupFilename } from '../shared/tagBackupFile';

export type TagBackupStatus =
  | { state: 'idle' }
  | { state: 'working' }
  | { state: 'exported' }
  | { state: 'imported'; summary: string }
  | { state: 'error'; error: string };

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Export and import of your tags as a JSON file. */
export function useTagBackup() {
  const [status, setStatus] = useState<TagBackupStatus>({ state: 'idle' });

  const exportTags = useCallback(async () => {
    setStatus({ state: 'working' });
    try {
      const backup = await sendMessage('exportTags', {});
      saveFile(
        tagBackupFilename(new Date()),
        new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }),
      );
      setStatus({ state: 'exported' });
    } catch (error) {
      setStatus({ state: 'error', error: errorText(error) });
    }
  }, []);

  const importTags = useCallback(async (file: File) => {
    setStatus({ state: 'working' });
    try {
      const backup = readTagBackup(await file.text());
      const summary = await sendMessage('importTags', { backup });
      setStatus({ state: 'imported', summary: importSummaryText(summary) });
    } catch (error) {
      setStatus({ state: 'error', error: errorText(error) });
    }
  }, []);

  return { status, exportTags, importTags };
}
