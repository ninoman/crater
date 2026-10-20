// Watches Bandcamp's following tab and takes over a sub-tab's list the first time it opens.
// Bandcamp switches sub-tabs with pushState, which a content script can't hook, so the `active`
// classes are the signal (decisions §8). The genres sub-tab is left alone.

import { FAN_PAGE_DOM } from '../../bandcamp';
import type { FollowKind } from '../../shared/following';
import { type TakenList, takeOverList } from './takeOverList';

const KINDS: readonly FollowKind[] = ['band', 'fan'];

/** The sub-tab of ours that's open (artists & labels or fans), or null for genres or closed. */
export function openFollowingKind(grid: Element): FollowKind | null {
  const { activeTabClass, followingSubTabs } = FAN_PAGE_DOM;
  if (!grid.classList.contains(activeTabClass)) return null;
  return (
    KINDS.find((kind) => grid.querySelector(`${followingSubTabs[kind]}.${activeTabClass}`)) ?? null
  );
}

export interface FollowingTabState {
  open: FollowKind | null;
  /** Lists taken over so far, in the order they were first opened. They stay taken over. */
  lists: readonly TakenList[];
}

/** The tab's state as an external store for useSyncExternalStore. */
export interface FollowingTab {
  getState: () => FollowingTabState;
  subscribe: (listener: () => void) => () => void;
}

/** Starts watching `grid` (Bandcamp's `#following-grid`). */
export function watchFollowingTab(doc: Document, grid: Element): FollowingTab {
  const listeners = new Set<() => void>();
  let state: FollowingTabState = { open: null, lists: [] };

  function refresh(): void {
    const open = openFollowingKind(grid);
    let { lists } = state;
    if (open && !lists.some((list) => list.kind === open)) {
      const list = takeOverList(doc, grid, open);
      if (list) lists = [...lists, list];
    }
    if (open === state.open && lists === state.lists) return;
    state = { open, lists };
    for (const listener of listeners) listener();
  }

  // Only the grid and its sub-tabs: watching the subtree would wake on every card change.
  const observer = new MutationObserver(refresh);
  const watch = { attributes: true, attributeFilter: ['class'] };
  observer.observe(grid, watch);
  for (const tab of grid.querySelectorAll(FAN_PAGE_DOM.followingSubTab))
    observer.observe(tab, watch);
  refresh();

  return {
    getState: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
