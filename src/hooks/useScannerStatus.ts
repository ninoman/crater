import { useCallback, useEffect, useState } from 'react';
import { sendMessage } from '../shared/messages';
import type { ScannerStatus } from '../shared/scan';

export type ScannerStatusView =
  | { state: 'loading' }
  | { state: 'ready'; status: ScannerStatus }
  | { state: 'unreachable'; error: string };

/** Polls the scanner's queue, budget and pause state while mounted. */
export function useScannerStatus(
  pollMs = 1000,
): ScannerStatusView & { refresh: () => Promise<void> } {
  const [view, setView] = useState<ScannerStatusView>({ state: 'loading' });

  const refresh = useCallback(() => {
    return sendMessage('getScannerStatus', {}).then(
      (status) => setView({ state: 'ready', status }),
      (error: unknown) => setView({ state: 'unreachable', error: String(error) }),
    );
  }, []);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), pollMs);
    return () => clearInterval(timer);
  }, [pollMs, refresh]);

  return { ...view, refresh };
}
