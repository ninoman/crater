import { useEffect, useRef } from 'react';
import { type ScanActivity, scanActivity } from '../shared/scanActivity';
import { useScannerStatus } from './useScannerStatus';

/**
 * What the scanner is doing, polled while mounted; null until the worker answers. Each time
 * more fans have been read, `onFansRead` runs, so a waiting list can ask for its rows again.
 */
export function useScanActivity(onFansRead: () => void): ScanActivity | null {
  const view = useScannerStatus(2000);
  const fansRead = view.state === 'ready' ? view.status.fansScanned : null;
  const seen = useRef<number | null>(null);

  useEffect(() => {
    if (fansRead === null) return;
    if (seen.current !== null && fansRead > seen.current) onFansRead();
    seen.current = fansRead;
  }, [fansRead, onFansRead]);

  return view.state === 'ready' ? scanActivity(view.status) : null;
}
