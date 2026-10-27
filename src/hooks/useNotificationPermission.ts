import { useCallback, useEffect, useState } from 'react';

const NOTIFICATIONS: chrome.permissions.Permissions = { permissions: ['notifications'] };

/**
 * Chrome's optional `notifications` permission (decisions §23): whether Crater has it, and a way
 * to ask for it. Asking must happen in a click handler, since Chrome only prompts on a gesture.
 */
export function useNotificationPermission(): {
  granted: boolean | null;
  request: () => Promise<boolean>;
} {
  const [granted, setGranted] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    chrome.permissions.contains(NOTIFICATIONS).then(
      (has) => !cancelled && setGranted(has),
      () => !cancelled && setGranted(false),
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const request = useCallback(async () => {
    const ok = await chrome.permissions.request(NOTIFICATIONS).catch(() => false);
    setGranted(ok);
    return ok;
  }, []);

  return { granted, request };
}
