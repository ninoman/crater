import { useCallback, useState } from 'react';
import { sendMessage } from '../shared/messages';

export interface ScannerControls {
  pause: () => void;
  resume: () => void;
  /** A pause or resume is on its way to the worker. */
  pending: boolean;
  error: string | null;
}

/** Pause and resume for the scanner. The status poll picks up the new state. */
export function useScannerControls(): ScannerControls {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = useCallback((type: 'pauseScanner' | 'resumeScanner') => {
    setPending(true);
    setError(null);
    sendMessage(type, {})
      .catch((reason: unknown) => setError(String(reason)))
      .finally(() => setPending(false));
  }, []);

  const pause = useCallback(() => send('pauseScanner'), [send]);
  const resume = useCallback(() => send('resumeScanner'), [send]);

  return { pause, resume, pending, error };
}
