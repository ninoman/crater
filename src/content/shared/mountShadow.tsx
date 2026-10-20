import { StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { PortalContainerProvider } from '../../ui';
import { createShadowSlot } from './shadowSlot';

/**
 * Renders React UI inside a shadow root attached to `parent`, so page CSS can't leak in.
 * `extraCss` is feature-specific styling (e.g. positioning) added after the shared UI styles.
 * Returns a function that removes the UI again.
 */
export function mountShadow(parent: Element, ui: ReactNode, extraCss = ''): () => void {
  const { host, container } = createShadowSlot(document, 'dighead-root', extraCss);
  parent.append(host);

  const root = createRoot(container);
  root.render(
    <StrictMode>
      <PortalContainerProvider container={container}>{ui}</PortalContainerProvider>
    </StrictMode>,
  );

  return () => {
    root.unmount();
    host.remove();
  };
}
