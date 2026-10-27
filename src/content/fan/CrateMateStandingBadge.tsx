import { useEffect } from 'react';
import { useCrateMateStanding } from '../../hooks/useCrateMateStanding';
import { CrateMateBadge } from './CrateMateBadge';

/**
 * Badge for a fan's profile header. Renders nothing while loading, on error, and for fans who
 * aren't your crate mates, so the header never shifts and a stranger's page stays quiet (decisions §7).
 */
export function CrateMateStandingBadge({ fanId }: { fanId: number }) {
  const view = useCrateMateStanding(fanId);

  useEffect(() => {
    if (view.state === 'unreachable') console.warn('crater: crate mate lookup failed', view.error);
  }, [view]);

  if (view.state !== 'ready' || !view.standing) return null;
  return <CrateMateBadge standing={view.standing} />;
}
