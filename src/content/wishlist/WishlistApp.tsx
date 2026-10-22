import { useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { PortalContainerProvider } from '../../ui';
import type { WishlistTab } from './wishlistTab';
import { WishlistView } from './WishlistView';

/** The wishlist tab's React root. Once taken over, the list stays mounted, filters and all. */
export function WishlistApp({ tab }: { tab: WishlistTab }) {
  const { open, taken } = useSyncExternalStore(tab.subscribe, tab.getState);
  if (!taken) return null;
  const { container } = taken.slot;
  return createPortal(
    <PortalContainerProvider container={container}>
      <WishlistView open={open} showBandcampList={taken.showBandcampList} />
    </PortalContainerProvider>,
    container,
  );
}
