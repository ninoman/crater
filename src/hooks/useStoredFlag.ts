import { useCallback, useEffect, useState } from 'react';

/**
 * A boolean UI preference kept in chrome.storage.local, so it holds across pages and tabs.
 * Starts at `initial` until storage answers.
 */
export function useStoredFlag(key: string, initial: boolean): [boolean, (value: boolean) => void] {
  const [value, setValue] = useState(initial);

  useEffect(() => {
    let cancelled = false;
    chrome.storage.local.get(key).then(
      (stored) => {
        const saved: unknown = stored[key];
        if (!cancelled && typeof saved === 'boolean') setValue(saved);
      },
      () => undefined, // keep the default
    );
    return () => {
      cancelled = true;
    };
  }, [key]);

  const update = useCallback(
    (next: boolean) => {
      setValue(next);
      void chrome.storage.local.set({ [key]: next });
    },
    [key],
  );

  return [value, update];
}
