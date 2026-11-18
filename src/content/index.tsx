// Content script entry: detects the page type and mounts the matching UI.
// Content scripts never fetch; all network goes through the service worker (decisions §5).

import { mountPageBadges } from './badges/mountPageBadges';
import { mountBand } from './band/mountBand';
import { mountFan } from './fan/mountFan';
import { detectPageKind } from './pageKind';
import { mountProfile } from './profile/mountProfile';
import { ReleaseSidebar } from './release/ReleaseSidebar';
import { ReleaseTagPrompts } from './release/ReleaseTagPrompts';
import sidebarCss from './release/ReleaseSidebar.css?inline';
import { reportCart } from './reportCart';
import { reportPage } from './reportPage';
import { pageTagsStyles } from './shared/tagStyles';
import { mountShadow } from './shared/mountShadow';
import { pageTheme } from './shared/pageTheme';
import { TaggingProvider } from './shared/tagging';
import { loadSettings } from '../shared/settings';

reportPage();
reportCart();

const kind = detectPageKind(document);
loadSettings()
  .catch((error: unknown) => {
    console.warn('crater: could not read settings; tags stay on', error);
    return { tagging: true };
  })
  .then(({ tagging }) => mountPage(tagging));

function mountPage(tagging: boolean): void {
  switch (kind) {
    case 'release':
      mountShadow(
        document.body,
        <TaggingProvider value={tagging}>
          <ReleaseSidebar />
        </TaggingProvider>,
        sidebarCss + pageTagsStyles,
        pageTheme(document),
      );
      // Apart from the sidebar, which renders nothing inside while collapsed.
      mountShadow(document.body, <ReleaseTagPrompts />, '', pageTheme(document));
      break;
    case 'band':
      mountBand(document, tagging);
      break;
    case 'own-fan':
      mountProfile(document, tagging);
      break;
    case 'fan':
      mountFan(document, tagging);
      break;
    case 'other':
      break;
  }
}

mountPageBadges(document, kind).catch((error: unknown) => {
  console.warn('crater: page badges failed to start', error);
});
