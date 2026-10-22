import { FAN_PAGE_DOM } from '../../bandcamp';
import { mountShadow } from '../shared/mountShadow';
import { WishlistApp } from './WishlistApp';
import { watchWishlistTab } from './wishlistTab';
import { wishlistCss } from './wishlistStyles';

/**
 * Takes over Bandcamp's wishlist tab on your own page: every release you wishlisted, with
 * tags, a filter bar and bulk tagging (decisions §13). The root itself renders nothing visible.
 */
export function mountWishlist(doc: Document): void {
  const grid = doc.querySelector(FAN_PAGE_DOM.wishlistGrid);
  if (!grid) {
    console.warn('dighead: wishlist tab not found; Bandcamp may have changed its layout');
    return;
  }
  mountShadow(grid, <WishlistApp tab={watchWishlistTab(doc, grid)} />, wishlistCss);
}
