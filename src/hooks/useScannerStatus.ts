import { useEffect, useState } from 'react';
import { sendMessage } from '../shared/messages';
import type { ScannerStatus } from '../shared/scan';

export type ScannerStatusView =
  | { state: 'loading' }
  | { state: 'ready'; status: ScannerStatus }
  | { state: 'unreachable'; error: string };

/** Polls the scanner's queue, budget and pause state while mounted. */
export function useScannerStatus(pollMs = 1000): ScannerStatusView {
  const [view, setView] = useState<ScannerStatusView>({ state: 'loading' });

  useEffect(() => {
    const refresh = () =>
      sendMessage('getScannerStatus', {}).then(
        (status) => setView({ state: 'ready', status }),
        (error: unknown) => setView({ state: 'unreachable', error: String(error) }),
      );
    void refresh();
    const timer = setInterval(() => void refresh(), pollMs);
    return () => clearInterval(timer);
  }, [pollMs]);

  return view;
}
