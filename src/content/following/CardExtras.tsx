import { memo } from 'react';
import type { Following } from '../../shared/following';
import type { CrateMateStanding } from '../../shared/crateMates';
import type { TagOption } from '../../ui';
import { followTagHandlers, type TagMutations } from '../shared/tagActions';
import { TagEditor } from '../shared/TagEditor';
import { CrateMateRank } from './CrateMateRank';

export interface CardExtrasProps {
  row: Following;
  tags: readonly TagOption[];
  mutations: TagMutations;
  onError: (message: string) => void;
  /** Fans on your crate mates leaderboard; null for everyone else and for bands. */
  standing: CrateMateStanding | null;
}

/**
 * What we add under a following card's name: its tags and, for fans, crate mate rank.
 * Memoised, since a list re-renders as a whole and can hold hundreds of cards.
 */
export const CardExtras = memo(function CardExtras({
  row,
  tags,
  mutations,
  onError,
  standing,
}: CardExtrasProps) {
  const handlers = followTagHandlers(mutations, [[row.kind, row.id]], row.tagIds, onError);
  return (
    <div className="dh-follow-card">
      <TagEditor tags={tags} assignedIds={row.tagIds} name={row.name} {...handlers} />
      {standing && <CrateMateRank standing={standing} />}
    </div>
  );
});
