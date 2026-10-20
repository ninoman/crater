import type { TwinStanding } from '../../shared/twins';
import { Badge, Tooltip } from '../../ui';
import { twinStandingHint } from '../shared/twinStandingHint';

/** "#4 twin" on a fan's card, with the numbers on hover and focus. */
export function TwinRank({ standing }: { standing: TwinStanding }) {
  return (
    <Tooltip content={twinStandingHint(standing)}>
      {/* A real button so keyboard users can focus it and get the tooltip. */}
      <button type="button" className="dh-twin-rank">
        <Badge>#{standing.rank} twin</Badge>
      </button>
    </Tooltip>
  );
}
