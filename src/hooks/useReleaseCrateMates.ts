import { useEffect, useState } from 'react';
import type { ItemKey } from '../bandcamp';
import { onWorkerEvent, sendMessage } from '../shared/messages';
import type { ReleaseCrateMatesResult } from '../shared/releaseCrateMates';

export type ReleaseCrateMatesView =
  | { state: 'loading' }
  | { state: 'ready'; result: ReleaseCrateMatesResult }
  | { state: 'unreachable'; error: string };

/**
 * Fetches your crate mates who own a release and follows the worker's updates as its supporters are
 * scanned. Waits for `enabled`, so the worker has saved the open release first.
 */
export function useReleaseCrateMates(releaseKey: ItemKey, enabled: boolean): ReleaseCrateMatesView {
  const [view, setView] = useState<ReleaseCrateMatesView>({ state: 'loading' });

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const unsubscribe = onWorkerEvent('releaseCrateMates', (result) => {
      if (!cancelled && result.releaseKey === releaseKey) setView({ state: 'ready', result });
    });
    sendMessage('getReleaseCrateMates', { itemKey: releaseKey }).then(
      (result) => !cancelled && setView({ state: 'ready', result }),
      (error: unknown) => !cancelled && setView({ state: 'unreachable', error: String(error) }),
    );
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [releaseKey, enabled]);

  return view;
}
