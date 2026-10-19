import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { injectStyles } from '../ui';
import { Popup } from './Popup';
import popupCss from './Popup.css?inline';

injectStyles(document, popupCss);

const container = document.getElementById('root');
if (!container) throw new Error('popup: #root missing');

createRoot(container).render(
  <StrictMode>
    <Popup />
  </StrictMode>,
);
