import type { TwinStanding } from '../../shared/twins';
import { Badge, Tooltip } from '../../ui';
import { twinRankLabel, twinStandingHint } from '../shared/twinStandingHint';

/** "your #4 twin (#2 lately) · 37 in common", with the numbers explained on hover and focus. */
export function TwinBadge({ standing }: { standing: TwinStanding }) {
  const { overlap } = standing;
  return (
    <Tooltip content={twinStandingHint(standing)}>
      {/* A real button so keyboard users can focus it and get the tooltip. */}
      <button type="button" className="dh-twin-badge">
        <Badge>
          your {twinRankLabel(standing)} · {overlap} in common
        </Badge>
      </button>
    </Tooltip>
  );
}
