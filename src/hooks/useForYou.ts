import { useCallback, useEffect, useState } from 'react';
import type { ItemKey } from '../bandcamp';
import type { ForYouResult } from '../shared/forYou';
import { sendMessage } from '../shared/messages';

export type ForYouView =
  | { state: 'loading' }
  | { state: 'ready'; result: ForYouResult }
  | { state: 'unreachable'; error: string };

/**
 * Fetches For you once on mount. `hide` drops a row and re-fetches, so the next pick moves up;
 * `reload` asks again, e.g. after an error.
 */
export function useForYou(): {
  view: ForYouView;
  reload: () => void;
  hide: (matchKey: ItemKey) => void;
} {
  const [view, setView] = useState<ForYouView>({ state: 'loading' });

  const load = useCallback(
    () =>
      sendMessage('getForYou', {}).then(
        (result) => setView({ state: 'ready', result }),
        (error: unknown) => setView({ state: 'unreachable', error: String(error) }),
      ),
    [],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const reload = useCallback(() => {
    setView({ state: 'loading' });
    void load();
  }, [load]);

  const hide = useCallback(
    (matchKey: ItemKey) => {
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
      sendMessage('hideRelease', { matchKey }).then(load, (error: unknown) =>
        setView({ state: 'unreachable', error: String(error) }),
      );
    },
    [load],
  );

  return { view, reload, hide };
}
