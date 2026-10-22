import { useCallback, useEffect, useRef, useState } from 'react';
import type { ItemKey } from '../bandcamp';
import type { ForYouMode, ForYouResult } from '../shared/forYou';
import { sendMessage } from '../shared/messages';

export type ForYouView =
  | { state: 'loading' }
  /** `loadedAt` stands in for now when saying how long ago a twin bought a pick. */
  | { state: 'ready'; result: ForYouResult; loadedAt: number }
  | { state: 'unreachable'; error: string };

/**
 * Fetches For you in `mode`, again whenever the mode changes. `hide` drops a row and
 * re-fetches, so the next pick moves up; `reload` asks again, e.g. after an error.
 */
export function useForYou(mode: ForYouMode): {
  view: ForYouView;
  reload: () => void;
  hide: (matchKey: ItemKey) => void;
} {
  const [view, setView] = useState<ForYouView>({ state: 'loading' });
  // Only the newest request may set the view, so a slow answer for the old mode can't win.
  const latest = useRef(0);

  const load = useCallback(() => {
    const request = ++latest.current;
    const settle = (next: ForYouView) => {
      if (request === latest.current) setView(next);
    };
    sendMessage('getForYou', { mode }).then(
      (result) => settle({ state: 'ready', result, loadedAt: Date.now() }),
      (error: unknown) => settle({ state: 'unreachable', error: String(error) }),
    );
  }, [mode]);

  useEffect(() => {
    setView({ state: 'loading' });
    load();
  }, [load]);

  const reload = useCallback(() => {
    setView({ state: 'loading' });
    load();
  }, [load]);

  const hide = useCallback(
    (matchKey: ItemKey) => {
      setView((current) =>
        current.state === 'ready'
          ? {
              ...current,
              result: {
                ...current.result,
                rows: current.result.rows.filter((row) => row.matchKey !== matchKey),
              },
            }
          : current,
      );
      sendMessage('hideRelease', { matchKey }).then(load, (error: unknown) =>
        setView({ state: 'unreachable', error: String(error) }),
      );
    },
    [load],
  );

  return { view, reload, hide };
}
