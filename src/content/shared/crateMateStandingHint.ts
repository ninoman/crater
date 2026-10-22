import type { CrateMateStanding } from '../../shared/crateMates';
import { formatMatch } from '../profile/crateMates/crateMatesView';

/** "#4 crate mate", "#4 crate mate (#2 lately)" or "#2 crate mate lately", depending on the boards the fan is on. */
export function crateMateRankLabel({ rank, latelyRank }: CrateMateStanding): string {
  if (rank !== null && latelyRank !== null) return `#${rank} crate mate (#${latelyRank} lately)`;
  if (rank !== null) return `#${rank} crate mate`;
  return `#${latelyRank} crate mate lately`;
}

/** The tooltip that explains a crate mate's numbers, wherever their rank is shown. */
export function crateMateStandingHint({
  rank,
  latelyRank,
  overlap,
  matchPct,
}: CrateMateStanding): string {
  const places = [
    rank !== null && `#${rank} on your crate-mates leaderboard`,
    latelyRank !== null && `#${latelyRank} on the lately board, which favours recent buying`,
  ].filter(Boolean);
  return `${places.join(', ')}. You both own ${overlap} releases, a ${formatMatch(matchPct / 100)} match: shared releases over both collections combined.`;
}
