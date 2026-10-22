import { useCallback, useEffect, useState } from 'react';
import { sendMessage } from '../shared/messages';
import type { CrateMatesResult } from '../shared/crateMates';

export type CrateMatesView =
  | { state: 'loading' }
  /** `loadedAt` stands in for now when showing how old the leaderboard is. */
  | { state: 'ready'; result: CrateMatesResult; loadedAt: number }
  | { state: 'unreachable'; error: string };

/** Fetches the crate-mates leaderboard once on mount. `reload` asks again, e.g. after an error. */
export function useCrateMates(): { view: CrateMatesView; reload: () => void } {
  const [view, setView] = useState<CrateMatesView>({ state: 'loading' });

  const load = useCallback(
    () =>
      sendMessage('getCrateMates', {}).then(
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
