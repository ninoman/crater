import type { CrateMateStanding } from '../../shared/crateMates';
import { Badge, Tooltip } from '../../ui';
import { crateMateRankLabel, crateMateStandingHint } from '../shared/crateMateStandingHint';

/** "#4 crate mate" on a fan's card, with the numbers on hover and focus. */
export function CrateMateRank({ standing }: { standing: CrateMateStanding }) {
  return (
    <Tooltip content={crateMateStandingHint(standing)}>
      {/* A real button so keyboard users can focus it and get the tooltip. */}
      <button type="button" className="dh-crate-mate-rank">
        <Badge>{crateMateRankLabel(standing)}</Badge>
      </button>
    </Tooltip>
  );
}
