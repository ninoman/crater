// Keeps row identity across refetches, so memoised rows skip re-rendering.

/**
 * `next`, with every row equal to its previous version swapped for that version. Returns `prev`
 * itself when nothing changed, so a refetch that changed nothing re-renders nothing.
 */
export function reuseUnchanged<T>(
  prev: readonly T[],
  next: readonly T[],
  key: (row: T) => string,
  same: (a: T, b: T) => boolean,
): readonly T[] {
  const before = new Map(prev.map((row) => [key(row), row]));
  const merged = next.map((row) => {
    const old = before.get(key(row));
    return old !== undefined && same(old, row) ? old : row;
  });
  const unchanged = merged.length === prev.length && merged.every((row, i) => row === prev[i]);
  return unchanged ? prev : merged;
}
