import { useEffect, useState } from 'react';
import type { ItemKey } from '../bandcamp';
import { onWorkerEvent, sendMessage } from '../shared/messages';
import type { ReleaseTwinsResult } from '../shared/releaseTwins';

export type ReleaseTwinsView =
  | { state: 'loading' }
  | { state: 'ready'; result: ReleaseTwinsResult }
  | { state: 'unreachable'; error: string };

/**
 * Fetches your twins who own a release and follows the worker's updates as its supporters are
 * scanned. Waits for `enabled`, so the worker has saved the open release first.
 */
export function useReleaseTwins(releaseKey: ItemKey, enabled: boolean): ReleaseTwinsView {
  const [view, setView] = useState<ReleaseTwinsView>({ state: 'loading' });

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const unsubscribe = onWorkerEvent('releaseTwins', (result) => {
      if (!cancelled && result.releaseKey === releaseKey) setView({ state: 'ready', result });
    });
    sendMessage('getReleaseTwins', { itemKey: releaseKey }).then(
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
