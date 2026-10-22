// Tells the hooks in this page that tags, followings or tagged wishlist items changed, so they
// refetch.
// A module-level bus is enough: all of a page's hooks share one module instance.

const listeners = new Set<() => void>();

export function notifyFollowingChanged(): void {
  for (const listener of [...listeners]) listener();
}

/** Returns an unsubscribe function. */
export function onFollowingChanged(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
