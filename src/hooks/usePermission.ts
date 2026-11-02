import { useCallback, useEffect, useState } from 'react';

export const NOTIFICATIONS: chrome.permissions.Permissions = { permissions: ['notifications'] };

/**
 * Whether Crater holds `permissions`, and a way to ask for them. Asking must happen in a click
 * handler, since browsers only prompt on a user gesture. Pass a module-level constant: a new
 * object each render would re-check every time.
 */
export function usePermission(permissions: chrome.permissions.Permissions): {
  granted: boolean | null;
  request: () => Promise<boolean>;
} {
  const [granted, setGranted] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    chrome.permissions.contains(permissions).then(
      (has) => !cancelled && setGranted(has),
      () => !cancelled && setGranted(false),
    );
    return () => {
      cancelled = true;
    };
  }, [permissions]);

  const request = useCallback(async () => {
    const ok = await chrome.permissions.request(permissions).catch(() => false);
    setGranted(ok);
    return ok;
  }, [permissions]);

  return { granted, request };
}
