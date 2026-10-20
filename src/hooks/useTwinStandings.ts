import type { TwinStanding } from '../shared/twins';
import { sendMessage } from '../shared/messages';
import { type QueryView, useFollowingQuery } from './useFollowingQuery';

/** Fan id to standing; fans not on your leaderboard are absent. */
export type TwinStandingsView = QueryView<Record<number, TwinStanding>>;

/** Standings for a whole list of fans in one message. */
export function useTwinStandings(fanIds: number[]): TwinStandingsView {
  return useFollowingQuery([...fanIds].sort((a, b) => a - b).join(','), () =>
    sendMessage('getTwinStandings', { fanIds }),
  );
}
