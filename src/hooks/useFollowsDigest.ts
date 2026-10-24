import { useCallback, useEffect, useState } from 'react';
import type { FollowsDigestResult, FollowsDigestVisit } from '../shared/followsDigest';
import { sendMessage } from '../shared/messages';
import { type RowActions, useRowActions } from './rowActions';

export type FollowsDigestView =
  | { state: 'loading' }
  | { state: 'ready'; result: FollowsDigestResult; loadedAt: number }
  | { state: 'unreachable'; error: string };

/** While reads of your follows are queued, the list is asked for again this often. */
const CHECKING_POLL_MS = 10_000;

// One visit per page load: switching tabs and back mustn't move "your last visit" up to now.
let visit: Promise<FollowsDigestVisit> | null = null;

function openedOnce(): Promise<FollowsDigestVisit> {
  visit ??= sendMessage('followsDigestOpened', {}).catch((error: unknown) => {
    visit = null;
    throw error;
  });
  return visit;
}

/** Forgets this page's visit. For tests. */
export function resetFollowsDigestVisit(): void {
  visit = null;
}

/**
 * New from your follows: records the visit once per page load, then fetches the digest, again
 * every few seconds while reads are queued, and whenever `hideHeard` changes. `mute`, `hide` and
 * `setHeard` update the list at once and then ask the worker.
 */
export function useFollowsDigest(hideHeard: boolean): RowActions & {
  view: FollowsDigestView;
  reload: () => void;
  mute: (bandId: number, muted: boolean) => void;
} {
  const [view, setView] = useState<FollowsDigestView>({ state: 'loading' });

  const load = useCallback(
    () =>
      openedOnce()
        .then(({ previousVisitAt }) =>
          sendMessage('getFollowsDigest', { previousVisitAt, hideHeard }),
        )
        .then(
          (result) => setView({ state: 'ready', result, loadedAt: Date.now() }),
          (error: unknown) => setView({ state: 'unreachable', error: String(error) }),
        ),
    [hideHeard],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const checking = view.state === 'ready' && view.result.checking > 0;
  useEffect(() => {
    if (!checking) return;
    const timer = setInterval(() => void load(), CHECKING_POLL_MS);
    return () => clearInterval(timer);
  }, [checking, load]);

  const reload = useCallback(() => {
    setView({ state: 'loading' });
    void load();
  }, [load]);

  const update = useCallback((change: (result: FollowsDigestResult) => FollowsDigestResult) => {
    setView((current) =>
      current.state === 'ready' ? { ...current, result: change(current.result) } : current,
    );
  }, []);

  const fail = useCallback(
    (error: unknown) => setView({ state: 'unreachable', error: String(error) }),
    [],
  );

  const mute = useCallback(
    (bandId: number, muted: boolean) => {
      update((result) => {
        const accounts = result.accounts.map((account) =>
          account.bandId === bandId ? { ...account, muted } : account,
        );
        const isMuted = new Set(accounts.filter((a) => a.muted).map((a) => a.bandId));
        const rows = result.rows.map((row) => ({
          ...row,
          muted: row.bandIds.every((id) => isMuted.has(id)),
        }));
        return { ...result, accounts, rows };
      });
      sendMessage('setFollowMute', { bandId, muted }).then(load, fail);
    },
    [update, load, fail],
  );

  const actions = useRowActions(setView, load, fail);

  return { view, reload, mute, ...actions };
}
