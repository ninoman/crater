// Watches Bandcamp's wishlist tab and takes its list over the first time it opens. Bandcamp
// switches tabs by moving the `active` class, which is the signal, as on the following tab.

import { FAN_PAGE_DOM } from '../../bandcamp';
import { type TakenWishlist, takeOverWishlist } from './takeOverWishlist';

export interface WishlistTabState {
  open: boolean;
  /** Taken over on first open, then kept. */
  taken: TakenWishlist | null;
}

/** The tab's state as an external store for useSyncExternalStore. */
export interface WishlistTab {
  getState: () => WishlistTabState;
  subscribe: (listener: () => void) => () => void;
}

/** Starts watching `grid` (Bandcamp's `#wishlist-grid`). */
export function watchWishlistTab(doc: Document, grid: Element): WishlistTab {
  const listeners = new Set<() => void>();
  let state: WishlistTabState = { open: false, taken: null };

  function refresh(): void {
    const open = grid.classList.contains(FAN_PAGE_DOM.activeTabClass);
    const taken = state.taken ?? (open ? takeOverWishlist(doc, grid) : null);
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
