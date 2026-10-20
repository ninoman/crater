import { useCallback, useState } from 'react';
import { sendMessage } from '../shared/messages';
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

/** Saves the file through a blob URL and a temporary link. */
function download(filename: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/** Export and import of your tags as a JSON file. */
export function useTagBackup() {
  const [status, setStatus] = useState<TagBackupStatus>({ state: 'idle' });

  const exportTags = useCallback(async () => {
    setStatus({ state: 'working' });
    try {
      const backup = await sendMessage('exportTags', {});
      download(tagBackupFilename(new Date()), JSON.stringify(backup, null, 2));
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
