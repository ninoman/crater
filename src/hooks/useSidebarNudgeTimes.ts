import { useCallback, useEffect, useState } from 'react';

const COLLAPSED_AT = 'sidebarCollapsedAt';
const LAST_NUDGE_AT = 'sidebarLastNudgeAt';
/** `useStoredFlag('sidebarOpen')`'s key, read here only to date collapses older than this hook. */
const SIDEBAR_OPEN = 'sidebarOpen';

export interface SidebarNudgeTimes {
  /** Null until storage answers, and while the sidebar has never been collapsed. */
  collapsedAt: number | null;
  lastNudgeAt: number | null;
  /** Call alongside collapsing the sidebar. */
  markCollapsed: () => void;
  /** Call when the comeback nudge is turned down. */
  markNudged: () => void;
}

function timestamp(value: unknown): number | null {
  return typeof value === 'number' ? value : null;
}

/**
 * The release sidebar's collapse and nudge times, kept in chrome.storage.local so they hold across
 * pages and tabs. A sidebar collapsed before these were stored is dated from the first page that
 * finds it, so it gets a nudge too, just later.
 */
export function useSidebarNudgeTimes(): SidebarNudgeTimes {
  const [collapsedAt, setCollapsedAt] = useState<number | null>(null);
  const [lastNudgeAt, setLastNudgeAt] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    chrome.storage.local.get([COLLAPSED_AT, LAST_NUDGE_AT, SIDEBAR_OPEN]).then(
      (stored) => {
        if (cancelled) return;
        let collapsed = timestamp(stored[COLLAPSED_AT]);
        if (collapsed === null && stored[SIDEBAR_OPEN] === false) {
          collapsed = Date.now();
          void chrome.storage.local.set({ [COLLAPSED_AT]: collapsed });
        }
        setCollapsedAt(collapsed);
        setLastNudgeAt(timestamp(stored[LAST_NUDGE_AT]));
      },
      () => undefined, // no nudge
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const markCollapsed = useCallback(() => {
    const now = Date.now();
    setCollapsedAt(now);
    void chrome.storage.local.set({ [COLLAPSED_AT]: now });
  }, []);

  const markNudged = useCallback(() => {
    const now = Date.now();
    setLastNudgeAt(now);
    void chrome.storage.local.set({ [LAST_NUDGE_AT]: now });
  }, []);

  return { collapsedAt, lastNudgeAt, markCollapsed, markNudged };
}
