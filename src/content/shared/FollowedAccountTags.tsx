import { useEffect, useMemo } from 'react';
import { useFollowTags } from '../../hooks/useFollowTags';
import { useTags } from '../../hooks/useTags';
import type { FollowKind } from '../../shared/following';
import { FollowTagEditor } from './FollowTagEditor';
import { followTagHandlers } from './followTagActions';

export interface FollowedAccountTagsProps {
  kind: FollowKind;
  id: number;
  name: string;
}

/**
 * Your tags on an account, on its own page. Renders nothing while loading, on error and when you
 * don't follow it, so the page never shifts and a stranger's page stays quiet (decisions §8).
 */
export function FollowedAccountTags({ kind, id, name }: FollowedAccountTagsProps) {
  const own = useFollowTags(kind, id);
  const all = useTags();
  const { create, assign } = all;
  const mutations = useMemo(() => ({ create, assign }), [create, assign]);

  useEffect(() => {
    if (own.state === 'unreachable') console.warn('dighead: tag lookup failed', own.error);
    if (all.view.state === 'unreachable') console.warn('dighead: tag list failed', all.view.error);
  }, [own, all.view]);

  if (own.state !== 'ready' || own.data === null || all.view.state !== 'ready') return null;

  const handlers = followTagHandlers(mutations, [[kind, id]], own.data, (message) =>
    console.warn('dighead: tagging failed', message),
  );
  return (
    <div className="dh-account-tags">
      <FollowTagEditor
        tags={all.view.data}
        assignedIds={own.data}
        accountName={name}
        {...handlers}
      />
    </div>
  );
}
