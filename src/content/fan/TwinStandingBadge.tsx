import { useEffect } from 'react';
import { useTwinStanding } from '../../hooks/useTwinStanding';
import { TwinBadge } from './TwinBadge';

/**
 * Badge for a fan's profile header. Renders nothing while loading, on error, and for fans who
 * aren't your twins, so the header never shifts and a stranger's page stays quiet (decisions §7).
 */
export function TwinStandingBadge({ fanId }: { fanId: number }) {
  const view = useTwinStanding(fanId);

  useEffect(() => {
    if (view.state === 'unreachable') console.warn('dighead: twin lookup failed', view.error);
  }, [view]);

  if (view.state !== 'ready' || !view.standing) return null;
  return <TwinBadge standing={view.standing} />;
}
