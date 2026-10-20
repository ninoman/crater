import { memo } from 'react';
import type { Following } from '../../shared/following';
import type { TwinStanding } from '../../shared/twins';
import { Checkbox, type TagOption } from '../../ui';
import { FollowTagEditor } from '../shared/FollowTagEditor';
import { followTagHandlers, type TagMutations } from '../shared/followTagActions';
import { TwinRank } from './TwinRank';

export interface CardExtrasProps {
  row: Following;
  tags: readonly TagOption[];
  selected: boolean;
  onSelect: (id: number, selected: boolean) => void;
  mutations: TagMutations;
  onError: (message: string) => void;
  /** Fans on your twins leaderboard; null for everyone else and for bands. */
  standing: TwinStanding | null;
}

/**
 * What we add inside a following card: the select box, its tags and, for fans, twin rank.
 * Memoised, since a list re-renders as a whole and can hold hundreds of cards.
 */
export const CardExtras = memo(function CardExtras({
  row,
  tags,
  selected,
  onSelect,
  mutations,
  onError,
  standing,
}: CardExtrasProps) {
  const handlers = followTagHandlers(mutations, [[row.kind, row.id]], row.tagIds, onError);
  return (
    <div className="dh-follow-card">
      <Checkbox
        label={`Select ${row.name}`}
        hideLabel
        checked={selected}
        onChange={(checked) => onSelect(row.id, checked)}
      />
      <FollowTagEditor tags={tags} assignedIds={row.tagIds} accountName={row.name} {...handlers} />
      {standing && <TwinRank standing={standing} />}
    </div>
  );
});
