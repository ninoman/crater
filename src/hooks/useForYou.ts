import { useCallback, useEffect, useRef, useState } from 'react';
import type { ForYouMode, ForYouResult } from '../shared/forYou';
import { sendMessage } from '../shared/messages';
import { type RowActions, useRowActions } from './rowActions';

export type ForYouView =
  | { state: 'loading' }
  /** `loadedAt` stands in for now when saying how long ago a crate mate bought a pick. */
  | { state: 'ready'; result: ForYouResult; loadedAt: number }
  | { state: 'unreachable'; error: string };

/**
 * Fetches For you in `mode`, again whenever the mode or `hideHeard` changes. `hide` drops the
 * rows it covers and re-fetches, so the next picks move up; `reload` asks again, e.g. after an
 * error; `refresh` asks again without going back to loading, once any request in flight answers.
 */
export function useForYou(
  mode: ForYouMode,
  hideHeard: boolean,
): RowActions & { view: ForYouView; reload: () => void; refresh: () => void } {
  const [view, setView] = useState<ForYouView>({ state: 'loading' });
  // Only the newest request may set the view, so a slow answer for the old mode can't win.
  const latest = useRef(0);
  const inFlight = useRef(false);
  const refreshQueued = useRef(false);

  const load = useCallback(
    function load() {
      const request = ++latest.current;
      inFlight.current = true;
      refreshQueued.current = false;
      const settle = (next: ForYouView) => {
        if (request !== latest.current) return;
        inFlight.current = false;
        setView(next);
        if (refreshQueued.current) load();
      };
      sendMessage('getForYou', { mode, hideHeard }).then(
        (result) => settle({ state: 'ready', result, loadedAt: Date.now() }),
        (error: unknown) => settle({ state: 'unreachable', error: String(error) }),
      );
    },
    [mode, hideHeard],
  );

  // Scan progress refreshes every few seconds. Superseding a slower request each time would
  // drop every answer and leave the tab loading for as long as the scan runs.
  const refresh = useCallback(() => {
    if (inFlight.current) refreshQueued.current = true;
    else load();
  }, [load]);

  useEffect(() => {
    setView({ state: 'loading' });
    load();
  }, [load]);

  const reload = useCallback(() => {
    setView({ state: 'loading' });
    load();
  }, [load]);

  const fail = useCallback(
    (error: unknown) => setView({ state: 'unreachable', error: String(error) }),
    [],
  );
  const actions = useRowActions(setView, load, fail);

  return { view, reload, refresh, ...actions };
}
