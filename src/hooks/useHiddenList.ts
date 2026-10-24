import { useCallback, useEffect, useState } from 'react';
import { type HiddenEntry, type HideTarget, hideTargetKey } from '../shared/hide';
import { sendMessage } from '../shared/messages';

export type HiddenListView =
  | { state: 'loading' }
  | { state: 'ready'; entries: HiddenEntry[]; loadedAt: number }
  | { state: 'unreachable'; error: string };

/** Everything you hid, for the popup (decisions §22). `unhide` drops the entry at once. */
export function useHiddenList(): {
  view: HiddenListView;
  reload: () => void;
  unhide: (target: HideTarget) => void;
} {
  const [view, setView] = useState<HiddenListView>({ state: 'loading' });

  const load = useCallback(
    () =>
      sendMessage('listHidden', {}).then(
        (entries) => setView({ state: 'ready', entries, loadedAt: Date.now() }),
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

  const unhide = useCallback((target: HideTarget) => {
    const key = hideTargetKey(target);
    setView((current) =>
      current.state === 'ready'
        ? {
            ...current,
            entries: current.entries.filter((entry) => hideTargetKey(entry.target) !== key),
          }
        : current,
    );
    sendMessage('unhide', { target }).catch((error: unknown) => {
      setView({ state: 'unreachable', error: String(error) });
    });
  }, []);

  return { view, reload, unhide };
}
