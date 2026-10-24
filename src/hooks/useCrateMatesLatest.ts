import { useCallback, useEffect, useState } from 'react';
import type { CrateMatesLatestResult } from '../shared/crateMatesLatest';
import { sendMessage } from '../shared/messages';
import { type RowActions, useRowActions } from './rowActions';

export type CrateMatesLatestView =
  | { state: 'loading' }
  | { state: 'ready'; result: CrateMatesLatestResult }
  | { state: 'unreachable'; error: string };

/**
 * Fetches Crate mates' latest on mount and whenever `hideHeard` changes. `hide` drops the rows
 * it covers and re-fetches; `reload` asks again, e.g. after an error.
 */
export function useCrateMatesLatest(
  hideHeard: boolean,
): RowActions & { view: CrateMatesLatestView; reload: () => void } {
  const [view, setView] = useState<CrateMatesLatestView>({ state: 'loading' });

  const load = useCallback(
    () =>
      sendMessage('getCrateMatesLatest', { hideHeard }).then(
        (result) => setView({ state: 'ready', result }),
        (error: unknown) => setView({ state: 'unreachable', error: String(error) }),
      ),
    [hideHeard],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const reload = useCallback(() => {
    setView({ state: 'loading' });
    void load();
  }, [load]);

  const fail = useCallback(
    (error: unknown) => setView({ state: 'unreachable', error: String(error) }),
    [],
  );
  const actions = useRowActions(setView, load, fail);

  return { view, reload, ...actions };
}
