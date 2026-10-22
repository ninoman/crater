// The badges placed so far, for the one React root that renders them all (decisions §15).

import type { BadgeText } from './badgeText';

export interface PlacedBadge {
  id: number;
  /** Inside the badge's own shadow root. */
  container: HTMLElement;
  text: BadgeText;
}

export interface BadgeStore {
  add(container: HTMLElement, text: BadgeText): void;
  subscribe(listener: () => void): () => void;
  getSnapshot(): readonly PlacedBadge[];
}

export function createBadgeStore(): BadgeStore {
  let badges: readonly PlacedBadge[] = [];
  let nextId = 0;
  const listeners = new Set<() => void>();
  return {
    add(container, text) {
      badges = [...badges, { id: nextId++, container, text }];
      for (const listener of listeners) listener();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot: () => badges,
  };
}
