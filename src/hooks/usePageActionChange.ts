import { useEffect, useRef } from 'react';
import { actionChange, type PageAction } from '../bandcamp';

/**
 * Calls `onChange` when you flip one of Bandcamp's controls on this page. Watches the whole body:
 * Bandcamp renders the heart after load and re-renders the follow button, so neither element is
 * there to watch for the life of the page.
 */
export function usePageActionChange(
  doc: Document,
  action: PageAction,
  onChange: (change: 'on' | 'off') => void,
): void {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    let state = action.isOn(doc);
    const observer = new MutationObserver(() => {
      const next = action.isOn(doc);
      const change = actionChange(state, next);
      // An unknown state keeps the last known one, so a re-render in between isn't a change.
      if (next !== null) state = next;
      if (change) onChangeRef.current(change);
    });
    observer.observe(doc.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['class'],
    });
    return () => observer.disconnect();
  }, [doc, action]);
}
