import { useEffect, useRef } from 'react';
import { cardWishlistChange } from '../bandcamp';

/**
 * Calls `onChange` when you flip the wishlist control of an item card on this page. Cards come
 * and go as you page, so this watches the body, and compares each changed element with its old
 * class rather than keeping state per card.
 */
export function useFanCardWishlistChange(
  doc: Document,
  onChange: (change: 'on' | 'off', actions: Element) => void,
): void {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    const observer = new MutationObserver((records) => {
      // One click is two class writes, so an element's first record holds its state before it.
      const before = new Map<Element, string>();
      for (const { target, oldValue } of records) {
        if (target instanceof Element && !before.has(target)) before.set(target, oldValue ?? '');
      }
      for (const [element, classes] of before) {
        const change = cardWishlistChange(element, classes);
        if (change) onChangeRef.current(change, element);
      }
    });
    observer.observe(doc.body, {
      subtree: true,
      attributes: true,
      attributeFilter: ['class'],
      attributeOldValue: true,
    });
    return () => observer.disconnect();
  }, [doc]);
}
