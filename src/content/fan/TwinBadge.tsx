import type { TwinStanding } from '../../shared/twins';
import { Badge, Tooltip } from '../../ui';
import { formatMatch } from '../profile/twins/twinsView';

/** "your #4 twin · 37 in common", with the numbers explained on hover and focus. */
export function TwinBadge({ standing }: { standing: TwinStanding }) {
  const { rank, overlap, matchPct } = standing;
  return (
    <Tooltip
      content={`#${rank} on your taste-twins leaderboard. You both own ${overlap} releases, a ${formatMatch(matchPct / 100)} match: shared releases over both collections combined.`}
    >
      {/* A real button so keyboard users can focus it and get the tooltip. */}
      <button type="button" className="dh-twin-badge">
        <Badge>
          your #{rank} twin · {overlap} in common
        </Badge>
      </button>
    </Tooltip>
  );
}
