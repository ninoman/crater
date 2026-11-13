import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ItemKey } from '../bandcamp';
import { applyOrder } from '../shared/itemOrder';
import type { CollectionReorderResult, ListedItem } from '../shared/itemList';
import { sendMessage } from '../shared/messages';
import { notifyFollowingChanged } from './followingChanges';

/** Bandcamp's own grid waits this long after a drop, so a few moves in a row save once. */
const SAVE_DELAY_MS = 3000;

function failure(result: Exclude<CollectionReorderResult, { status: 'done' }>): string {
  switch (result.status) {
    case 'signed-out':
      return 'Bandcamp didn’t give Crater a session to save with. Check you’re logged in, then try again.';
    case 'too-many':
      return `Bandcamp doesn’t sort collections over ${result.limit.toLocaleString()} items.`;
    case 'not-synced':
      return 'Crater hasn’t read your whole collection yet. Try again once the sync is done.';
  }
}

function inOrder(items: readonly ListedItem[], itemKeys: readonly ItemKey[]): boolean {
  return items.length === itemKeys.length && items.every((item, i) => item.itemKey === itemKeys[i]);
}

export interface CollectionReorder {
  /** The list in its new order while the save is on its way. */
  items: readonly ListedItem[];
  reorder: (itemKeys: ItemKey[]) => void;
  /** A new order is waiting to be saved or being saved. */
  saving: boolean;
}

/**
 * Shows a new collection order at once and saves it to Bandcamp 3 s after the last drop, as
 * Bandcamp's own grid does (decisions §29). A failed save puts the list back and says why.
 */
export function useCollectionReorder(
  items: readonly ListedItem[],
  onError: (message: string) => void,
): CollectionReorder {
  const [order, setOrder] = useState<readonly ItemKey[] | null>(null);
  const [saving, setSaving] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const latest = useRef(0);
  /** The list as it was when a save landed; the next one is the reload in the new order. */
  const savedFrom = useRef<readonly ListedItem[] | null>(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const save = useCallback((itemKeys: ItemKey[]) => {
    const n = ++latest.current;
    const fail = (message: string) => {
      setOrder(null);
      onErrorRef.current(message);
    };
    // One at a time, so Bandcamp gets them in the order they were made.
    queue.current = queue.current.then(async () => {
      if (n !== latest.current) return;
      try {
        const result = await sendMessage('reorderCollection', { itemKeys });
        if (n !== latest.current) return;
        if (result.status === 'done') {
          // Already in this order (moved and moved back): the reload would look the same.
          if (inOrder(itemsRef.current, itemKeys)) setOrder(null);
          else savedFrom.current = itemsRef.current;
          notifyFollowingChanged();
        } else {
          fail(failure(result));
        }
      } catch {
        if (n === latest.current) fail('Bandcamp didn’t save the new order. Try again.');
      } finally {
        if (n === latest.current) setSaving(false);
      }
    });
  }, []);

  const reorder = useCallback(
    (itemKeys: ItemKey[]) => {
      setOrder(itemKeys);
      setSaving(true);
      savedFrom.current = null;
      clearTimeout(timer.current);
      timer.current = setTimeout(() => save(itemKeys), SAVE_DELAY_MS);
    },
    [save],
  );

  // The list reloaded after a save, already in the new order.
  useEffect(() => {
    if (savedFrom.current !== null && savedFrom.current !== items) {
      savedFrom.current = null;
      setOrder(null);
    }
  }, [items]);

  // Leaving before Bandcamp has the new order would lose it, so the page asks first.
  useEffect(() => {
    if (!saving) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [saving]);

  useEffect(() => () => clearTimeout(timer.current), []);

  const ordered = useMemo(() => (order ? applyOrder(items, order) : items), [items, order]);
  return { items: ordered, reorder, saving };
}
