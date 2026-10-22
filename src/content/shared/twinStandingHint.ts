import type { TwinStanding } from '../../shared/twins';
import { formatMatch } from '../profile/twins/twinsView';

/** "#4 twin", "#4 twin (#2 lately)" or "#2 twin lately", depending on the boards the fan is on. */
export function twinRankLabel({ rank, latelyRank }: TwinStanding): string {
  if (rank !== null && latelyRank !== null) return `#${rank} twin (#${latelyRank} lately)`;
  if (rank !== null) return `#${rank} twin`;
  return `#${latelyRank} twin lately`;
}

/** The tooltip that explains a twin's numbers, wherever their rank is shown. */
export function twinStandingHint({ rank, latelyRank, overlap, matchPct }: TwinStanding): string {
  const places = [
    rank !== null && `#${rank} on your taste-twins leaderboard`,
    latelyRank !== null && `#${latelyRank} on the lately board, which favours recent buying`,
  ].filter(Boolean);
  return `${places.join(', ')}. You both own ${overlap} releases, a ${formatMatch(matchPct / 100)} match: shared releases over both collections combined.`;
}
