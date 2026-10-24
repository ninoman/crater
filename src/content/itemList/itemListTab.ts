// Watches Bandcamp's wishlist or collection tab and takes its list over the first time it opens.
// Bandcamp switches tabs by moving the `active` class, which is the signal, as on the following tab.

import { FAN_PAGE_DOM } from '../../bandcamp';
import type { ListConfig } from './lists';
import { type TakenList, takeOverItemList } from './takeOverItemList';

export interface ItemListTabState {
  open: boolean;
  /** Taken over on first open, then kept. */
  taken: TakenList | null;
}

/** The tab's state as an external store for useSyncExternalStore. */
export interface ItemListTab {
  getState: () => ItemListTabState;
  subscribe: (listener: () => void) => () => void;
}

/** Starts watching `grid` (Bandcamp's `#wishlist-grid` or `#collection-grid`). */
export function watchItemListTab(doc: Document, grid: Element, list: ListConfig): ItemListTab {
  const listeners = new Set<() => void>();
  let state: ItemListTabState = { open: false, taken: null };

  function refresh(): void {
    const open = grid.classList.contains(FAN_PAGE_DOM.activeTabClass);
    const taken = state.taken ?? (open ? takeOverItemList(doc, grid, list) : null);
    if (open === state.open && taken === state.taken) return;
    state = { open, taken };
    for (const listener of listeners) listener();
  }

  // Only the grid's own class: watching the subtree would wake on Bandcamp's paging.
  new MutationObserver(refresh).observe(grid, { attributes: true, attributeFilter: ['class'] });
  refresh();

  return {
    getState: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
