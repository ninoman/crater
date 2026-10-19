import { StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { injectStyles, PortalContainerProvider } from '../../ui';

/**
 * Renders React UI inside a shadow root attached to `parent`, so page CSS can't leak in.
 * `extraCss` is feature-specific styling (e.g. positioning) added after the shared UI styles.
 * Returns a function that removes the UI again.
 */
export function mountShadow(parent: Element, ui: ReactNode, extraCss = ''): () => void {
  const host = document.createElement('dighead-root');
  const shadow = host.attachShadow({ mode: 'open' });
  injectStyles(shadow, extraCss);

  const container = document.createElement('div');
  container.className = 'dh-root';
  shadow.append(container);
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
