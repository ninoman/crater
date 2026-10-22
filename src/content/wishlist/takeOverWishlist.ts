// Puts our wishlist in place of Bandcamp's paged one, inside the wishlist tab. Bandcamp's list
// renders 20 items at a time behind "view all", so a tag filter over it would be wrong
// (decisions §13). Ours sits before Bandcamp's, all in one shadow root.

import { FAN_PAGE_DOM } from '../../bandcamp';
import { createShadowSlot, type ShadowSlot } from '../shared/shadowSlot';
import { wishlistCss } from './wishlistStyles';

/** On Bandcamp's items container while its own list is hidden. */
export const WISHLIST_TAKEN_CLASS = 'dighead-wishlist-taken';

const STYLE_ID = 'dighead-wishlist';

function pageCss(): string {
  const { wishlistNativeList, wishlistExpand } = FAN_PAGE_DOM;
  return `.${WISHLIST_TAKEN_CLASS} > ${wishlistNativeList},
.${WISHLIST_TAKEN_CLASS} > ${wishlistExpand} { display: none !important; }
dighead-wishlist { display: block; }`;
}

function addPageStyle(doc: Document): void {
  if (doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = pageCss();
  doc.head.append(style);
}

export interface TakenWishlist {
  /** Our list's shadow root, right above Bandcamp's hidden one. */
  slot: ShadowSlot;
  /** Shows Bandcamp's own list when ours can't stand in for it. */
  showBandcampList: (shown: boolean) => void;
}

/** Null, with a warning, when the items container isn't where we expect. */
export function takeOverWishlist(doc: Document, grid: Element): TakenWishlist | null {
  const container = grid.querySelector(FAN_PAGE_DOM.wishlistItems);
  if (!container) {
    console.warn('dighead: wishlist items not found; Bandcamp may have changed its layout');
    return null;
  }
  addPageStyle(doc);

  const slot = createShadowSlot(doc, 'dighead-wishlist', wishlistCss);
  const native = container.querySelector(`:scope > ${FAN_PAGE_DOM.wishlistNativeList}`);
  if (native) native.before(slot.host);
  else container.prepend(slot.host);
  container.classList.add(WISHLIST_TAKEN_CLASS);

  return {
    slot,
    showBandcampList: (shown) => container.classList.toggle(WISHLIST_TAKEN_CLASS, !shown),
  };
}
