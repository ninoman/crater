import { useCallback, useEffect, useState } from 'react';
import type { ItemKey } from '../bandcamp';
import { sendMessage } from '../shared/messages';
import type { TwinsLatestResult } from '../shared/twinsLatest';

export type TwinsLatestView =
  | { state: 'loading' }
  | { state: 'ready'; result: TwinsLatestResult }
  | { state: 'unreachable'; error: string };

/**
 * Fetches Twins' latest once on mount. `hide` drops a row and re-fetches; `reload` asks again,
 * e.g. after an error.
 */
export function useTwinsLatest(): {
  view: TwinsLatestView;
  reload: () => void;
  hide: (matchKey: ItemKey) => void;
} {
  const [view, setView] = useState<TwinsLatestView>({ state: 'loading' });

  const load = useCallback(
    () =>
      sendMessage('getTwinsLatest', {}).then(
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
