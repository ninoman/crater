import { createContext, useContext, type ReactNode } from 'react';

// Radix portals default to document.body, which is outside our shadow root and loses our styles.
// Overlay components (Tooltip, Dropdown, Dialog) must pass this container to their Portal.
const PortalContainerContext = createContext<HTMLElement | null>(null);

export function PortalContainerProvider({
  container,
  children,
}: {
  container: HTMLElement;
  children: ReactNode;
}) {
  return (
    <PortalContainerContext.Provider value={container}>{children}</PortalContainerContext.Provider>
  );
}

export function usePortalContainer(): HTMLElement | null {
  return useContext(PortalContainerContext);
}
