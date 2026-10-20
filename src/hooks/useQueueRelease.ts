import { useCallback, useState } from 'react';
import type { ItemKey } from '../bandcamp';
import { sendMessage } from '../shared/messages';
import type { QueueReleaseStatus } from '../shared/scan';

export type QueueReleaseState =
  | { state: 'idle' }
  | { state: 'queueing' }
  | { state: 'done'; status: QueueReleaseStatus }
  | { state: 'error'; error: string };

/** Asks the worker to scan one release's supporters, and tracks the answer for its row. */
export function useQueueRelease(
  itemKey: ItemKey,
  url: string,
): { queue: QueueReleaseState; queueRelease: () => Promise<void> } {
  const [queue, setQueue] = useState<QueueReleaseState>({ state: 'idle' });

  const queueRelease = useCallback(async () => {
    setQueue({ state: 'queueing' });
    try {
      const { status } = await sendMessage('queueRelease', { itemKey, url });
      setQueue({ state: 'done', status });
    } catch (error) {
      setQueue({ state: 'error', error: String(error) });
    }
  }, [itemKey, url]);

  return { queue, queueRelease };
}
