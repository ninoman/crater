// Message handlers for your Bandcamp cart: the buttons on recommendation rows, and the cart a
// page shows, which keeps our copy current.

import { type FetchJson, type FetchText, setInCart } from '../bandcamp';
import { type CraterDb, getMe } from '../db';
import type { MessageHandlers } from '../shared/messages';
import { saveCart } from './cartStore';
import { ensureSessionOrigin } from './sessionOrigin';

export function cartHandlers(
  db: CraterDb,
  fetchJson: FetchJson,
  fetchText: FetchText,
): Pick<MessageHandlers, 'setInCart' | 'cartSeen'> {
  return {
    setInCart: async ({ url, itemKey, inCart }) => {
      await ensureSessionOrigin();
      const me = await getMe(db);
      const change = await setInCart({ fetchText, fetchJson }, url, {
        wanted: itemKey,
        inCart,
        fanId: me?.fanId ?? null,
        localId: () => String(Math.random()),
      });
      if (change.status === 'free') return change;
      await saveCart(change.cart);
      return { status: 'done' };
    },
    cartSeen: async ({ cart }) => {
      await saveCart(cart);
      return null;
    },
  };
}
