// Puts our list in place of Bandcamp's paged one, inside its wishlist or collection tab.
// Bandcamp's list renders 20 items at a time behind "view all", so a tag filter over it would be
// wrong (decisions §14). Ours sits before Bandcamp's, all in one shadow root.

import { FAN_PAGE_DOM } from '../../bandcamp';
import { createShadowSlot, type ShadowSlot } from '../shared/shadowSlot';
import { itemListCss } from './itemListStyles';
import type { ListConfig } from './lists';

const takenClass = (list: ListConfig) => `crater-${list.noun}-taken`;
const tagName = (list: ListConfig) => `crater-${list.noun}`;

// Bandcamp's search box sits in the tab bar, away from the items, so `:has` ties it to them.
// Ours searches the whole list; theirs only its own hidden pages.
function pageCss(list: ListConfig): string {
  const { itemsNativeList, itemsExpand } = FAN_PAGE_DOM;
  return `.${takenClass(list)} > ${itemsNativeList},
.${takenClass(list)} > ${itemsExpand},
body:has(.${takenClass(list)}) ${list.search} { display: none !important; }
${tagName(list)} { display: block; }`;
}

function addPageStyle(doc: Document, list: ListConfig): void {
  if (doc.getElementById(tagName(list))) return;
  const style = doc.createElement('style');
  style.id = tagName(list);
  style.textContent = pageCss(list);
  doc.head.append(style);
}

export interface TakenList {
  /** Our list's shadow root, right above Bandcamp's hidden one. */
  slot: ShadowSlot;
  /** Shows Bandcamp's own list when ours can't stand in for it. */
  showBandcampList: (shown: boolean) => void;
}

/** Null, with a warning, when the items container isn't where we expect. */
export function takeOverItemList(doc: Document, grid: Element, list: ListConfig): TakenList | null {
  const container = grid.querySelector(list.items);
  if (!container) {
    console.warn(`crater: ${list.noun} items not found; Bandcamp may have changed its layout`);
    return null;
  }
  addPageStyle(doc, list);

  const slot = createShadowSlot(doc, tagName(list), itemListCss);
  const native = container.querySelector(`:scope > ${FAN_PAGE_DOM.itemsNativeList}`);
  if (native) native.before(slot.host);
  else container.prepend(slot.host);
  container.classList.add(takenClass(list));

  return {
    slot,
    showBandcampList: (shown) => container.classList.toggle(takenClass(list), !shown),
  };
}
