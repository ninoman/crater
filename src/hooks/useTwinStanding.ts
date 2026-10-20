import { useEffect, useState } from 'react';
import { sendMessage } from '../shared/messages';
import type { TwinStanding } from '../shared/twins';

export type TwinStandingView =
  | { state: 'loading' }
  /** `standing` is null when the fan isn't on your leaderboard. */
  | { state: 'ready'; standing: TwinStanding | null }
  | { state: 'unreachable'; error: string };

/** Looks up where a fan stands among your twins, once per fan. */
export function useTwinStanding(fanId: number): TwinStandingView {
  const [view, setView] = useState<TwinStandingView>({ state: 'loading' });

  useEffect(() => {
    let cancelled = false;
    setView({ state: 'loading' });
    sendMessage('getTwinStanding', { fanId }).then(
      (standing) => !cancelled && setView({ state: 'ready', standing }),
      (error: unknown) => !cancelled && setView({ state: 'unreachable', error: String(error) }),
    );
    return () => {
      cancelled = true;
    };
  }, [fanId]);

  return view;
}
