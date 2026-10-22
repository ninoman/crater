import { useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { Badge } from '../../ui';
import type { BadgeStore } from './badgeStore';

/** Every page badge, each portalled into its own shadow root next to its link. */
export function BadgeLayer({ store }: { store: BadgeStore }) {
  const badges = useSyncExternalStore(store.subscribe, store.getSnapshot);
  return badges.map(({ id, container, text }) =>
    createPortal(<Badge title={text.hint}>{text.label}</Badge>, container, String(id)),
  );
}
