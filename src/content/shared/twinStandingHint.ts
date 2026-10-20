import type { TwinStanding } from '../../shared/twins';
import { formatMatch } from '../profile/twins/twinsView';

/** The tooltip that explains a twin's numbers, wherever their rank is shown. */
export function twinStandingHint({ rank, overlap, matchPct }: TwinStanding): string {
  return `#${rank} on your taste-twins leaderboard. You both own ${overlap} releases, a ${formatMatch(matchPct / 100)} match: shared releases over both collections combined.`;
}
