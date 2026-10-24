import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_SORT, type SortSpec, validSort } from '../shared/itemSort';
import type { ListSource } from '../shared/itemList';

const storageKey = (source: ListSource) => `sort:${source}`;

function isSortSpec(value: unknown): value is SortSpec {
  if (typeof value !== 'object' || value === null) return false;
  const { key, direction } = value as Record<string, unknown>;
  return typeof key === 'string' && (direction === 'asc' || direction === 'desc');
}

/**
 * A tab's sort, kept in chrome.storage.local so it holds across pages and reloads, one per tab
 * (decisions §24). Starts at the default until storage answers.
 */
export function useStoredSort(source: ListSource): [SortSpec, (sort: SortSpec) => void] {
  const [sort, setSort] = useState(DEFAULT_SORT);
  const key = storageKey(source);

  useEffect(() => {
    let cancelled = false;
    chrome.storage.local.get(key).then(
      (stored) => {
        const saved: unknown = stored[key];
        // A key this list doesn't offer, from a newer or older build, falls back to the default.
        if (!cancelled && isSortSpec(saved)) setSort(validSort(saved, source));
      },
      () => undefined, // keep the default
    );
    return () => {
      cancelled = true;
    };
  }, [key, source]);

  const update = useCallback(
    (next: SortSpec) => {
      setSort(next);
      void chrome.storage.local.set({ [key]: next });
    },
    [key],
  );

  return [sort, update];
}
