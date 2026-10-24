import { mountShadow } from '../shared/mountShadow';
import { ItemListApp } from './ItemListApp';
import { itemListCss } from './itemListStyles';
import { watchItemListTab } from './itemListTab';
import type { ListConfig } from './lists';

/**
 * Takes over Bandcamp's wishlist or collection tab on your own page: every item you have, with
 * tags, a filter bar and bulk tagging (decisions §14, §24). The root itself
 * renders nothing visible.
 */
export function mountItemList(doc: Document, list: ListConfig): void {
  const grid = doc.querySelector(list.grid);
  if (!grid) {
    console.warn(`dighead: ${list.noun} tab not found; Bandcamp may have changed its layout`);
    return;
  }
  mountShadow(
    grid,
    <ItemListApp tab={watchItemListTab(doc, grid, list)} list={list} />,
    itemListCss,
  );
}
