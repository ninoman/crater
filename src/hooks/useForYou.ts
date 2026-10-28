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
 * error; `refresh` asks again without going back to loading.
 */
export function useForYou(
  mode: ForYouMode,
  hideHeard: boolean,
): RowActions & { view: ForYouView; reload: () => void; refresh: () => void } {
  const [view, setView] = useState<ForYouView>({ state: 'loading' });
  // Only the newest request may set the view, so a slow answer for the old mode can't win.
  const latest = useRef(0);

  const load = useCallback(() => {
    const request = ++latest.current;
    const settle = (next: ForYouView) => {
      if (request === latest.current) setView(next);
    };
    sendMessage('getForYou', { mode, hideHeard }).then(
      (result) => settle({ state: 'ready', result, loadedAt: Date.now() }),
      (error: unknown) => settle({ state: 'unreachable', error: String(error) }),
    );
  }, [mode, hideHeard]);

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

  return { view, reload, refresh: load, ...actions };
}
