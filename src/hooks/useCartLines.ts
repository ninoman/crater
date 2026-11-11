// The cart buttons on a list's rows: add the digital release to your Bandcamp cart, or take it
// out. Optimistic: the button shows the change at once and goes back if Bandcamp refuses. A
// release with nothing to pay opens its page instead.

import { useCallback, useState } from 'react';
import type { ItemKey } from '../bandcamp';
import { sendMessage } from '../shared/messages';
import type { CartLine } from '../ui';

export interface CartLines {
  line: (itemKey: ItemKey) => CartLine;
  toggle: (itemKey: ItemKey, url: string) => void;
}

/** Lines start out of the cart: lists leave out what's already in it. */
const OUT: CartLine = { inCart: false, status: 'idle' };

export function useCartLines(): CartLines {
  const [lines, setLines] = useState<ReadonlyMap<ItemKey, CartLine>>(new Map());

  const setLine = useCallback((key: ItemKey, line: CartLine) => {
    setLines((current) => new Map(current).set(key, line));
  }, []);

  const line = useCallback((key: ItemKey) => lines.get(key) ?? OUT, [lines]);

  const toggle = useCallback(
    (itemKey: ItemKey, url: string) => {
      const { inCart, status } = lines.get(itemKey) ?? OUT;
      if (status === 'saving') return;
      setLine(itemKey, { inCart: !inCart, status: 'saving' });
      sendMessage('setInCart', { url, itemKey, inCart: !inCart }).then(
        (change) => {
          if (change.status === 'done') {
            setLine(itemKey, { inCart: !inCart, status: 'idle' });
            return;
          }
          setLine(itemKey, OUT);
          window.open(change.url, '_blank', 'noopener');
        },
        (error: unknown) => {
          console.warn('crater: could not change your cart', error);
          setLine(itemKey, { inCart, status: 'error' });
        },
      );
    },
    [lines, setLine],
  );

  return { line, toggle };
}
