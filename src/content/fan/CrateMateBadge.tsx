import type { CrateMateStanding } from '../../shared/crateMates';
import { Badge, Tooltip } from '../../ui';
import { crateMateRankLabel, crateMateStandingHint } from '../shared/crateMateStandingHint';

/** "your #4 crate mate (#2 lately) · 37 in common", with the numbers explained on hover and focus. */
export function CrateMateBadge({ standing }: { standing: CrateMateStanding }) {
  const { overlap } = standing;
  return (
    <Tooltip content={crateMateStandingHint(standing)}>
      {/* A real button so keyboard users can focus it and get the tooltip. */}
      <button type="button" className="dh-crate-mate-badge">
        <Badge>
          your {crateMateRankLabel(standing)} · {overlap} in common
        </Badge>
      </button>
    </Tooltip>
  );
}
