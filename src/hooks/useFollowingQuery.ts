import { useEffect, useRef, useState } from 'react';
import { onFollowingChanged } from './followingChanges';

export type QueryView<T> =
  | { state: 'loading' }
  | { state: 'ready'; data: T }
  | { state: 'unreachable'; error: string };

/**
 * Runs `fetch` when `key` changes and again whenever tags or followings change. A refetch keeps
 * the current data on screen until the new answer lands. `key` must cover everything `fetch` reads.
 */
export function useFollowingQuery<T>(key: string, fetch: () => Promise<T>): QueryView<T> {
  const [view, setView] = useState<QueryView<T>>({ state: 'loading' });
  const fetchRef = useRef(fetch);
  fetchRef.current = fetch;

  // biome-ignore lint/correctness/useExhaustiveDependencies: `key` stands for what `fetch` reads
  useEffect(() => {
    let cancelled = false;
    const load = () =>
      fetchRef.current().then(
        (data) => !cancelled && setView({ state: 'ready', data }),
        (error: unknown) => !cancelled && setView({ state: 'unreachable', error: String(error) }),
      );
    setView({ state: 'loading' });
    void load();
    const off = onFollowingChanged(() => void load());
    return () => {
      cancelled = true;
      off();
    };
  }, [key]);

  return view;
}
