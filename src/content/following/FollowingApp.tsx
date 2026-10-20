import { useSyncExternalStore } from 'react';
import type { FollowingTab } from './followingTab';
import { FollowingTakeover } from './FollowingTakeover';

/** The one React root for the following tab. Lists stay mounted once opened, filters and all. */
export function FollowingApp({ tab }: { tab: FollowingTab }) {
  const { open, lists } = useSyncExternalStore(tab.subscribe, tab.getState);
  return lists.map((taken) => (
    <FollowingTakeover key={taken.kind} taken={taken} open={open === taken.kind} />
  ));
}
