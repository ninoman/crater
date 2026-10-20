// Content script entry: detects the page type and mounts the matching UI.
// Content scripts never fetch; all network goes through the service worker (decisions §5).

import { detectPageKind } from './pageKind';
import { mountProfile } from './profile/mountProfile';
import { ReleaseSidebar } from './release/ReleaseSidebar';
import sidebarCss from './release/ReleaseSidebar.css?inline';
import { reportPage } from './reportPage';
import { mountShadow } from './shared/mountShadow';

reportPage();

switch (detectPageKind(document)) {
  case 'release':
    mountShadow(document.body, <ReleaseSidebar />, sidebarCss);
    break;
  case 'own-fan':
    mountProfile(document);
    break;
  case 'fan':
  case 'other':
    break;
}
