import { useEffect, useRef, useState } from 'react';
import { type ScanActivity, scanActivity } from '../shared/scanActivity';
import type { SyncingActivity } from '../shared/sync';
import { useScannerStatus } from './useScannerStatus';
import { useSyncStatus } from './useSyncStatus';

/**
 * What the sync and scanner are doing, polled while mounted; null until the worker answers. Each
 * time more fans have been read, `onFansRead` runs, so a list built from crate mates can ask for
 * its rows again.
 */
export function useScanActivity(onFansRead: () => void): ScanActivity | null {
  const scanner = useScannerStatus(2000);
  const sync = useSyncStatus();
  const fansRead = scanner.state === 'ready' ? scanner.status.fansScanned : null;
  const seen = useRef<number | null>(null);
  const syncing = syncingActivity(sync.view);
  const wasSyncing = useRef(false);
  // The scanner status read before the sync ended says "nothing queued"; wait for a fresh one.
  const [settling, setSettling] = useState(false);

  useEffect(() => {
    if (fansRead === null) return;
    if (seen.current !== null && fansRead > seen.current) onFansRead();
    seen.current = fansRead;
  }, [fansRead, onFansRead]);

  const { refresh } = scanner;
  useEffect(() => {
    const ended = wasSyncing.current && !syncing;
    wasSyncing.current = syncing !== null;
    if (!ended) return;
    setSettling(true);
    void refresh().finally(() => setSettling(false));
  }, [syncing, refresh]);

  if (syncing) return { kind: 'syncing', sync: syncing };
  if (settling || scanner.state !== 'ready') return null;
  return scanActivity(scanner.status);
}

function syncingActivity(view: ReturnType<typeof useSyncStatus>['view']): SyncingActivity | null {
  if (view.state !== 'ready' || view.status.state !== 'known') return null;
  return view.status.activity.state === 'syncing' ? view.status.activity : null;
}
