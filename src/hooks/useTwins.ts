import { useCallback, useEffect, useState } from 'react';
import { sendMessage } from '../shared/messages';
import type { TwinsResult } from '../shared/twins';

export type TwinsView =
  | { state: 'loading' }
  /** `loadedAt` stands in for now when showing how old the leaderboard is. */
  | { state: 'ready'; result: TwinsResult; loadedAt: number }
  | { state: 'unreachable'; error: string };

/** Fetches the taste-twins leaderboard once on mount. `reload` asks again, e.g. after an error. */
export function useTwins(): { view: TwinsView; reload: () => void } {
  const [view, setView] = useState<TwinsView>({ state: 'loading' });

  const load = useCallback(
    () =>
      sendMessage('getTwins', {}).then(
        (result) => setView({ state: 'ready', result, loadedAt: Date.now() }),
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

  return { view, reload };
}
