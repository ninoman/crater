import { useEffect, useState } from 'react';
import { sendMessage } from '../shared/messages';
import type { CrateMateStanding } from '../shared/crateMates';

export type CrateMateStandingView =
  | { state: 'loading' }
  /** `standing` is null when the fan isn't on your leaderboard. */
  | { state: 'ready'; standing: CrateMateStanding | null }
  | { state: 'unreachable'; error: string };

/** Looks up where a fan stands among your crate mates, once per fan. */
export function useCrateMateStanding(fanId: number): CrateMateStandingView {
  const [view, setView] = useState<CrateMateStandingView>({ state: 'loading' });

  useEffect(() => {
    let cancelled = false;
    setView({ state: 'loading' });
    sendMessage('getCrateMateStanding', { fanId }).then(
      (standing) => !cancelled && setView({ state: 'ready', standing }),
      (error: unknown) => !cancelled && setView({ state: 'unreachable', error: String(error) }),
    );
    return () => {
      cancelled = true;
    };
  }, [fanId]);

  return view;
}
