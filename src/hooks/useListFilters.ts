import { useCallback, useEffect, useMemo, useState } from 'react';
import { hasPlace, type ListFilters, NO_FILTERS, sanitizeFilters } from '../shared/listFilters';
import { useHomePlace } from './useHomePlace';

/** The lists that remember their filters (decisions §25). */
export type FilteredList = 'forYou' | 'alsoBought' | 'latest';

const storageKey = (list: FilteredList) => `listFilters.${list}`;

export interface ListFiltersState {
  /** What to ask the worker for: "Near me" is off while no place is saved. */
  filters: ListFilters;
  setFilters: (next: ListFilters) => void;
  /** The saved filters have been read, so the list can be fetched with them. */
  ready: boolean;
  place: string;
}

/**
 * A list's filters, kept in chrome.storage.local so they hold across pages, tabs and visits.
 * Each list has its own, apart from the modes of For you, which share one set.
 */
export function useListFilters(list: FilteredList): ListFiltersState {
  const [stored, setStored] = useState<ListFilters>(NO_FILTERS);
  const [ready, setReady] = useState(false);
  const place = useHomePlace();

  useEffect(() => {
    let cancelled = false;
    chrome.storage.local.get(storageKey(list)).then(
      (items) => {
        if (cancelled) return;
        setStored(sanitizeFilters(items[storageKey(list)]));
        setReady(true);
      },
      () => !cancelled && setReady(true), // no saved filters: start unfiltered
    );
    return () => {
      cancelled = true;
    };
  }, [list]);

  const setFilters = useCallback(
    (next: ListFilters) => {
      setStored(next);
      void chrome.storage.local.set({ [storageKey(list)]: next });
    },
    [list],
  );

  const filters = useMemo(
    () => (stored.nearMe && !hasPlace(place) ? { ...stored, nearMe: false } : stored),
    [stored, place],
  );
  return { filters, setFilters, ready, place };
}
