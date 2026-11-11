import { ParserError, readPageCart } from '../bandcamp';
import { sendMessage } from '../shared/messages';

/**
 * Tells the worker what's in your cart, from the page's own copy, so lists leave it out. Only
 * release and band pages carry one.
 */
export function reportCart(): void {
  let cart: ReturnType<typeof readPageCart>;
  try {
    cart = readPageCart(document);
  } catch (error) {
    if (error instanceof ParserError) {
      console.warn('crater: cannot read the cart', error);
      return;
    }
    throw error;
  }
  if (!cart) return;
  sendMessage('cartSeen', { cart }).catch((error: unknown) =>
    console.warn('crater: worker unreachable', error),
  );
}
