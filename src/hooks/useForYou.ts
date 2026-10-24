import { useCallback, useEffect, useRef, useState } from 'react';
import type { ForYouMode, ForYouResult } from '../shared/forYou';
import type { ListFilters } from '../shared/listFilters';
import { sendMessage } from '../shared/messages';
import { type RowActions, useRowActions } from './rowActions';

export type ForYouView =
  | { state: 'loading' }
  /** `loadedAt` stands in for now when saying how long ago a crate mate bought a pick. */
  | { state: 'ready'; result: ForYouResult; loadedAt: number }
  | { state: 'unreachable'; error: string };

/**
 * Fetches For you in `mode`, again whenever the mode, `hideHeard` or the filters change, once
 * `enabled` (the saved filters have been read). `hide` drops the rows it covers and re-fetches,
 * so the next picks move up; `reload` asks again, e.g. after an error.
 */
export function useForYou(
  mode: ForYouMode,
  hideHeard: boolean,
  filters: ListFilters,
  enabled = true,
): RowActions & { view: ForYouView; reload: () => void } {
  const [view, setView] = useState<ForYouView>({ state: 'loading' });
  // Only the newest request may set the view, so a slow answer for the old mode can't win.
  const latest = useRef(0);

  const load = useCallback(() => {
    const request = ++latest.current;
    const settle = (next: ForYouView) => {
      if (request === latest.current) setView(next);
    };
    sendMessage('getForYou', { mode, hideHeard, filters }).then(
      (result) => settle({ state: 'ready', result, loadedAt: Date.now() }),
      (error: unknown) => settle({ state: 'unreachable', error: String(error) }),
    );
  }, [mode, hideHeard, filters]);

  useEffect(() => {
    if (!enabled) return;
    setView({ state: 'loading' });
    load();
  }, [load, enabled]);

  const reload = useCallback(() => {
    setView({ state: 'loading' });
    load();
  }, [load]);

  const fail = useCallback(
    (error: unknown) => setView({ state: 'unreachable', error: String(error) }),
    [],
  );
  const actions = useRowActions(setView, load, fail);

  return { view, reload, ...actions };
}
