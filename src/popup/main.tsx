import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { injectStyles, PortalContainerProvider } from '../ui';
import { Popup } from './Popup';
import popupCss from './Popup.css?inline';

injectStyles(document, popupCss);

const container = document.getElementById('root');
if (!container) throw new Error('popup: #root missing');

// Dialogs portal into #root rather than <body>, so they stay inside .dh-root's base styles.
createRoot(container).render(
  <StrictMode>
    <PortalContainerProvider container={container}>
      <Popup />
    </PortalContainerProvider>
  </StrictMode>,
);
