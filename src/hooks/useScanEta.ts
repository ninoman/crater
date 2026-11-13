import { useEffect, useState } from 'react';
import { addSample, etaMs, type ScanSample } from '../shared/scanEta';

/**
 * Milliseconds until `remaining` more lists are read, at the pace seen since the page opened.
 * Null until there's enough to go on, and while the scanner is stopped.
 */
export function useScanEta(scanned: number, remaining: number, stopped: boolean): number | null {
  const [samples, setSamples] = useState<ScanSample[]>([]);

  useEffect(() => {
    setSamples((current) => addSample(current, { at: Date.now(), scanned }));
  }, [scanned]);

  return stopped ? null : etaMs(samples, remaining);
}
