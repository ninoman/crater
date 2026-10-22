import type { CrateMateStanding } from '../shared/crateMates';
import { sendMessage } from '../shared/messages';
import { type QueryView, useFollowingQuery } from './useFollowingQuery';

/** Fan id to standing; fans not on your leaderboard are absent. */
export type CrateMateStandingsView = QueryView<Record<number, CrateMateStanding>>;

/** Standings for a whole list of fans in one message. */
export function useCrateMateStandings(fanIds: number[]): CrateMateStandingsView {
  return useFollowingQuery([...fanIds].sort((a, b) => a - b).join(','), () =>
    sendMessage('getCrateMateStandings', { fanIds }),
  );
}
