import { useCallback, useEffect, useState } from 'react';
import type { ItemKey } from '../bandcamp';
import type { AlsoBoughtResult } from '../shared/alsoBought';
import { onWorkerEvent, sendMessage } from '../shared/messages';

export type AlsoBoughtView =
  | { state: 'loading' }
  | { state: 'ready'; result: AlsoBoughtResult }
  | { state: 'unreachable'; error: string };

/**
 * Fetches the Also-bought list for a release and follows the worker's re-scores. Waits for
 * `enabled`, so the worker has saved the open release before the first score.
 */
export function useAlsoBought(
  releaseKey: ItemKey,
  enabled: boolean,
): { view: AlsoBoughtView; hide: (matchKey: ItemKey) => void } {
  const [view, setView] = useState<AlsoBoughtView>({ state: 'loading' });

  const refresh = useCallback(
    () =>
      sendMessage('getAlsoBought', { itemKey: releaseKey }).then(
        (result) => setView({ state: 'ready', result }),
        (error: unknown) => setView({ state: 'unreachable', error: String(error) }),
      ),
    [releaseKey],
  );

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const unsubscribe = onWorkerEvent('alsoBought', (result) => {
      if (!cancelled && result.releaseKey === releaseKey) setView({ state: 'ready', result });
    });
    void refresh();
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [releaseKey, enabled, refresh]);

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
