import { useEffect, useState } from 'react';
import { sendMessage } from '../shared/messages';

export type WorkerStatus =
  | { state: 'connecting' }
  | { state: 'connected'; version: string }
  | { state: 'unreachable'; error: string };

/** Pings the service worker once on mount. */
export function useWorkerStatus(): WorkerStatus {
  const [status, setStatus] = useState<WorkerStatus>({ state: 'connecting' });

  useEffect(() => {
    let cancelled = false;
    sendMessage('ping', {}).then(
      ({ version }) => !cancelled && setStatus({ state: 'connected', version }),
      (error: unknown) => !cancelled && setStatus({ state: 'unreachable', error: String(error) }),
    );
    return () => {
      cancelled = true;
    };
  }, []);

  return status;
}
