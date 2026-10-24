import { useCallback, useEffect, useState } from 'react';
import type { ItemKey } from '../bandcamp';
import type { AlsoBoughtResult } from '../shared/alsoBought';
import { type ListFilters, NO_FILTERS, sameFilters } from '../shared/listFilters';
import { onWorkerEvent, sendMessage } from '../shared/messages';

export type AlsoBoughtView =
  | { state: 'loading' }
  | { state: 'ready'; result: AlsoBoughtResult }
  | { state: 'unreachable'; error: string };

/**
 * Fetches the Also-bought list for a release and follows the worker's re-scores. Waits for
 * `enabled`, so the worker has saved the open release before the first score. A re-score built
 * with other filters than ours (the worker forgot them) is not shown; the list is asked for again.
 */
export function useAlsoBought(
  releaseKey: ItemKey,
  enabled: boolean,
  filters: ListFilters,
): { view: AlsoBoughtView; hide: (matchKey: ItemKey) => void } {
  const [view, setView] = useState<AlsoBoughtView>({ state: 'loading' });

  const refresh = useCallback(
    () =>
      sendMessage('getAlsoBought', { itemKey: releaseKey, filters }).then(
        (result) => setView({ state: 'ready', result }),
        (error: unknown) => setView({ state: 'unreachable', error: String(error) }),
      ),
    [releaseKey, filters],
  );

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const unsubscribe = onWorkerEvent('alsoBought', (result) => {
      if (cancelled || result.releaseKey !== releaseKey) return;
      if (sameFilters(result.filtered?.filters ?? NO_FILTERS, filters)) {
        setView({ state: 'ready', result });
      } else void refresh();
    });
    void refresh();
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [releaseKey, enabled, refresh, filters]);

  const hide = useCallback(
    (matchKey: ItemKey) => {
      // Drop the row at once; the re-score brings in the next one.
      setView((current) =>
        current.state === 'ready'
          ? {
              state: 'ready',
              result: {
                ...current.result,
                rows: current.result.rows.filter((row) => row.matchKey !== matchKey),
              },
            }
          : current,
      );
      sendMessage('hideRelease', { matchKey }).then(refresh, (error: unknown) =>
        setView({ state: 'unreachable', error: String(error) }),
      );
    },
    [refresh],
  );

  return { view, hide };
}
