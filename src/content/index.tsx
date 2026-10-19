// Content script entry: detects the page type and mounts the matching UI.
// Content scripts never fetch; all network goes through the service worker (decisions §5).

import { detectPageKind } from './pageKind';
import { ReleaseSidebar } from './release/ReleaseSidebar';
import sidebarCss from './release/ReleaseSidebar.css?inline';
import { mountShadow } from './shared/mountShadow';

switch (detectPageKind(document)) {
  case 'release':
    mountShadow(document.body, <ReleaseSidebar />, sidebarCss);
    break;
  case 'fan':
  case 'other':
    // Profile tabs arrive in Phase 5.
    break;
}
