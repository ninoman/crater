import { useCallback, useEffect, useState } from 'react';
import { sendMessage } from '../shared/messages';
import type { SyncStatus } from '../shared/sync';

export type SyncStatusView =
  | { state: 'loading' }
  /** checkedAt: when the status was read, for "synced 5 minutes ago". */
  | { state: 'ready'; status: SyncStatus; checkedAt: number }
  | { state: 'unreachable'; error: string };

const POLL_MS = 1000;

/** Polls the worker's sync status while mounted. The popup is short-lived, so polling is cheap. */
export function useSyncStatus(): { view: SyncStatusView; resync: () => void } {
  const [view, setView] = useState<SyncStatusView>({ state: 'loading' });

  const refresh = useCallback(() => {
    sendMessage('getSyncStatus', {}).then(
      (status) => setView({ state: 'ready', status, checkedAt: Date.now() }),
      (error: unknown) => setView({ state: 'unreachable', error: String(error) }),
    );
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, POLL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  const resync = useCallback(() => {
    sendMessage('resync', {}).then(refresh, (error: unknown) =>
      setView({ state: 'unreachable', error: String(error) }),
    );
  }, [refresh]);

  return { view, resync };
}
