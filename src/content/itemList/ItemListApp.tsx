import { useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { PortalContainerProvider } from '../../ui';
import type { ItemListTab } from './itemListTab';
import { ItemListView } from './ItemListView';
import type { ListConfig } from './lists';

/** A list tab's React root. Once taken over, the list stays mounted, filters and all. */
export function ItemListApp({ tab, list }: { tab: ItemListTab; list: ListConfig }) {
  const { open, taken } = useSyncExternalStore(tab.subscribe, tab.getState);
  if (!taken) return null;
  const { container } = taken.slot;
  return createPortal(
    <PortalContainerProvider container={container}>
      <ItemListView list={list} open={open} showBandcampList={taken.showBandcampList} />
    </PortalContainerProvider>,
    container,
  );
}
