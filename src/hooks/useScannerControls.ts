import { useCallback, useState } from 'react';
import { sendMessage } from '../shared/messages';

export interface ScannerControls {
  pause: () => void;
  resume: () => void;
  /** Queues the job that broke a parser again. */
  retryParser: () => void;
  /** A pause, resume or retry is on its way to the worker. */
  pending: boolean;
  error: string | null;
}

/**
 * Pause, resume and parser retry for the scanner. The status poll picks up the new state; pass `onSettled` to
 * show it sooner than the next poll.
 */
export function useScannerControls(onSettled?: () => void): ScannerControls {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = useCallback(
    (type: 'pauseScanner' | 'resumeScanner' | 'retryBrokenParser') => {
      setPending(true);
      setError(null);
      sendMessage(type, {})
        .catch((reason: unknown) => setError(String(reason)))
        .finally(() => {
          setPending(false);
          onSettled?.();
        });
    },
    [onSettled],
  );

  const pause = useCallback(() => send('pauseScanner'), [send]);
  const resume = useCallback(() => send('resumeScanner'), [send]);
  const retryParser = useCallback(() => send('retryBrokenParser'), [send]);

  return { pause, resume, retryParser, pending, error };
}
