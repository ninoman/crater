import { useEffect, useState } from 'react';
import type { ReleasePageItem } from '../bandcamp';
import { onWorkerEvent, sendMessage } from '../shared/messages';
import type { ScanProgress } from '../shared/scan';

export type ScanProgressView =
  | { state: 'loading' }
  | { state: 'ready'; progress: ScanProgress }
  | { state: 'unreachable'; error: string };

/** Tells the worker this release is open (so it's scanned first) and follows its progress. */
export function useScanProgress(item: ReleasePageItem): ScanProgressView {
  const [view, setView] = useState<ScanProgressView>({ state: 'loading' });

  useEffect(() => {
    let cancelled = false;
    const unsubscribe = onWorkerEvent('scanProgress', (progress) => {
      if (!cancelled && progress.releaseKey === item.itemKey) setView({ state: 'ready', progress });
    });
    sendMessage('releaseOpened', { item }).then(
      // An event may have arrived first with newer numbers; keep it.
      (progress) =>
        !cancelled && setView((v) => (v.state === 'ready' ? v : { state: 'ready', progress })),
      (error: unknown) => !cancelled && setView({ state: 'unreachable', error: String(error) }),
    );
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [item]);

  return view;
}
