import { useCallback, useEffect, useState } from 'react';
import type { ItemKey } from '../bandcamp';
import type { AlsoBoughtResult, AlsoBoughtRow } from '../shared/alsoBought';
import { onWorkerEvent, sendMessage } from '../shared/messages';
import { inRankOrder, isOutOfOrder, keepOrder } from './keptOrder';
import { type RowActions, useRowActions, withRows } from './rowActions';

export type AlsoBoughtView =
  | { state: 'loading' }
  | { state: 'ready'; result: AlsoBoughtResult }
  | { state: 'unreachable'; error: string };

/**
 * Fetches the Also-bought list for a release and follows the worker's re-scores. Waits for
 * `enabled`, so the worker has saved the open release before the first score. Re-scores pushed
 * to tabs keep heard releases in, so while those are hidden the list is asked for again.
 * Re-scores keep the rows in place; `reorder`, null while they're in rank order, applies the latest.
 */
export function useAlsoBought(
  releaseKey: ItemKey,
  enabled: boolean,
  hideHeard: boolean,
): RowActions & { view: AlsoBoughtView; reorder: (() => void) | null } {
  const [view, setView] = useState<AlsoBoughtView>({ state: 'loading' });
  const [ranked, setRanked] = useState<readonly ItemKey[]>([]);

  const show = useCallback((result: AlsoBoughtResult) => {
    setRanked(result.rows.map((row) => row.matchKey));
    setView((current) => {
      const shown = current.state === 'ready' ? current.result.rows : [];
      return { state: 'ready', result: { ...result, rows: keepOrder(shown, result.rows) } };
    });
  }, []);

  const refresh = useCallback(
    () =>
      sendMessage('getAlsoBought', { itemKey: releaseKey, hideHeard }).then(
        show,
        (error: unknown) => setView({ state: 'unreachable', error: String(error) }),
      ),
    [releaseKey, hideHeard, show],
  );

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const unsubscribe = onWorkerEvent('alsoBought', (result) => {
      if (cancelled || result.releaseKey !== releaseKey) return;
      if (!hideHeard) show(result);
      else void refresh();
    });
    void refresh();
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [releaseKey, enabled, hideHeard, refresh, show]);

  const fail = useCallback(
    (error: unknown) => setView({ state: 'unreachable', error: String(error) }),
    [],
  );
  // The re-score after a hide brings in the next rows.
  const actions = useRowActions(setView, refresh, fail);

  const reorder = useCallback(
    () =>
      setView((current) =>
        withRows<AlsoBoughtRow, AlsoBoughtView>(current, (rows) => inRankOrder(rows, ranked)),
      ),
    [ranked],
  );
  const outOfOrder = view.state === 'ready' && isOutOfOrder(view.result.rows, ranked);

  return { view, reorder: outOfOrder ? reorder : null, ...actions };
}
