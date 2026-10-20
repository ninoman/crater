import { useCallback, useState } from 'react';
import { sendMessage } from '../shared/messages';

export type ClearDataState =
  { state: 'idle' } | { state: 'clearing' } | { state: 'done' } | { state: 'error'; error: string };

/** Asks the worker to delete everything Dighead has stored. */
export function useClearData(): { status: ClearDataState; clear: () => Promise<void> } {
  const [status, setStatus] = useState<ClearDataState>({ state: 'idle' });

  const clear = useCallback(async () => {
    setStatus({ state: 'clearing' });
    try {
      await sendMessage('clearAllData', {});
      setStatus({ state: 'done' });
    } catch (error) {
      setStatus({ state: 'error', error: String(error) });
    }
  }, []);

  return { status, clear };
}
