import { useEffect, useState } from 'react';
import { sendMessage } from '../shared/messages';
import type { ScannerStatus } from '../shared/scan';

export type ScannerStatusView =
  | { state: 'loading' }
  | { state: 'ready'; status: ScannerStatus }
  | { state: 'unreachable'; error: string };

const POLL_MS = 1000;

/** Polls the scanner's queue, budget and pause state while mounted. */
export function useScannerStatus(): ScannerStatusView {
  const [view, setView] = useState<ScannerStatusView>({ state: 'loading' });

  useEffect(() => {
    const refresh = () =>
      sendMessage('getScannerStatus', {}).then(
        (status) => setView({ state: 'ready', status }),
        (error: unknown) => setView({ state: 'unreachable', error: String(error) }),
      );
    void refresh();
    const timer = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(timer);
  }, []);

  return view;
}
