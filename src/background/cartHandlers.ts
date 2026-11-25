// Message handlers for your Bandcamp cart: the buttons on recommendation rows, and the cart a
// page shows, which keeps our copy current.

import {
  type CartChange,
  type FetchJson,
  type FetchText,
  isBandcampUrl,
  setInCart,
  setInCartFromApi,
} from '../bandcamp';
import { type CraterDb, getMe } from '../db';
import type { MessageHandlers } from '../shared/messages';
import { loadCart, saveCart } from './cartStore';
import { sellerOf } from './sellerOf';
import { ensureSessionOrigin } from './sessionOrigin';

export function cartHandlers(
  db: CraterDb,
  fetchJson: FetchJson,
  fetchText: FetchText,
): Pick<MessageHandlers, 'setInCart' | 'cartSeen'> {
  return {
    setInCart: async ({ url, itemKey, inCart }) => {
      const fetchers = { fetchText, fetchJson };
      const me = await getMe(db);
      const wanted = {
        wanted: itemKey,
        inCart,
        fanId: me?.fanId ?? null,
        localId: () => String(Math.random()),
      };
      let change: CartChange;
      if (isBandcampUrl(url)) {
        await ensureSessionOrigin();
        change = await setInCart(fetchers, url, wanted);
      } else {
        // A custom domain's page can't be fetched (§5): price and cart come from bandcamp.com.
        const sellerId = await sellerOf(db, url, [itemKey]);
        if (sellerId === null) return { status: 'free', url };
        await ensureSessionOrigin();
        change = await setInCartFromApi(
          fetchers,
          { url, sellerId, cart: await loadCart() },
          wanted,
        );
      }
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
