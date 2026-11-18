import { useEffect, useState } from 'react';
import { loadSettings } from '../shared/settings';

/** The saved *Tags* setting, kept current as it's saved. Null until it has loaded. */
export function useTaggingOn(): boolean | null {
  const [on, setOn] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    const read = () => {
      loadSettings().then(
        (settings) => !cancelled && setOn(settings.tagging),
        (error: unknown) => console.warn('crater: could not read settings', error),
      );
    };
    read();
    const onChanged = (_changes: unknown, area: string) => area === 'local' && read();
    chrome.storage.onChanged.addListener(onChanged);
    return () => {
      cancelled = true;
      chrome.storage.onChanged.removeListener(onChanged);
    };
  }, []);

  return on;
}
