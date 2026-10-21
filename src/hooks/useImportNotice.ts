import { useCallback, useEffect, useState } from 'react';
import type { ImportNotice } from '../shared/backupFile';
import { sendMessage } from '../shared/messages';

/** What the worker found after an interrupted import, until you dismiss it. */
export function useImportNotice(): { notice: ImportNotice | null; dismiss: () => void } {
  const [notice, setNotice] = useState<ImportNotice | null>(null);

  useEffect(() => {
    sendMessage('getImportNotice', {}).then(setNotice, () => undefined);
  }, []);

  const dismiss = useCallback(() => {
    setNotice(null);
    void sendMessage('dismissImportNotice', {}).catch(() => undefined);
  }, []);

  return { notice, dismiss };
}
