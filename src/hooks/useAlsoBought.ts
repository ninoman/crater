import { useCallback, useEffect, useState } from 'react';
import type { ItemKey } from '../bandcamp';
import type { AlsoBoughtPrefs, AlsoBoughtResult } from '../shared/alsoBought';
import { onWorkerEvent, sendMessage } from '../shared/messages';
import { type RowActions, useRowActions } from './rowActions';

export type AlsoBoughtView =
  | { state: 'loading' }
  | { state: 'ready'; result: AlsoBoughtResult }
  | { state: 'unreachable'; error: string };

/**
 * Fetches the Also-bought list for a release and follows the worker's re-scores. Waits for
 * `enabled`, so the worker has saved the open release before the first score. Re-scores pushed
 * to tabs use the worker's defaults, so while the switches differ the list is asked for again.
 */
export function useAlsoBought(
  releaseKey: ItemKey,
  enabled: boolean,
  { hideHeard, albumBuyers }: Required<AlsoBoughtPrefs>,
): RowActions & { view: AlsoBoughtView } {
  const [view, setView] = useState<AlsoBoughtView>({ state: 'loading' });

  const refresh = useCallback(
    () =>
      sendMessage('getAlsoBought', { itemKey: releaseKey, hideHeard, albumBuyers }).then(
        (result) => setView({ state: 'ready', result }),
        (error: unknown) => setView({ state: 'unreachable', error: String(error) }),
      ),
    [releaseKey, hideHeard, albumBuyers],
  );

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const unsubscribe = onWorkerEvent('alsoBought', (result) => {
      if (cancelled || result.releaseKey !== releaseKey) return;
      if (!hideHeard && albumBuyers) setView({ state: 'ready', result });
      else void refresh();
    });
    void refresh();
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [releaseKey, enabled, hideHeard, albumBuyers, refresh]);

  const fail = useCallback(
    (error: unknown) => setView({ state: 'unreachable', error: String(error) }),
    [],
  );
  // The re-score after a hide brings in the next rows.
  const actions = useRowActions(setView, refresh, fail);

  return { view, ...actions };
}
