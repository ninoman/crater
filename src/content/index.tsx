// Content script entry: detects the page type and mounts the matching UI.
// Content scripts never fetch; all network goes through the service worker (decisions §5).

import { mountBand } from './band/mountBand';
import { mountFan } from './fan/mountFan';
import { detectPageKind } from './pageKind';
import { mountProfile } from './profile/mountProfile';
import { ReleaseSidebar } from './release/ReleaseSidebar';
import sidebarCss from './release/ReleaseSidebar.css?inline';
import { reportPage } from './reportPage';
import { pageTagsStyles } from './shared/tagStyles';
import { mountShadow } from './shared/mountShadow';
import { pageTheme } from './shared/pageTheme';

reportPage();

switch (detectPageKind(document)) {
  case 'release':
    mountShadow(
      document.body,
      <ReleaseSidebar />,
      sidebarCss + pageTagsStyles,
      pageTheme(document),
    );
    break;
  case 'band':
    mountBand(document);
    break;
  case 'own-fan':
    mountProfile(document);
    break;
  case 'fan':
    mountFan(document);
    break;
  case 'other':
    break;
}
