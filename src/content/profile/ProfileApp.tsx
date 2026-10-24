import { useSyncExternalStore, type ComponentType } from 'react';
import { useScannerNotices } from '../../hooks/useScannerNotices';
import { NoticeStack } from '../../ui';
import { CrateMatesTab } from './crateMates/CrateMatesTab';
import { ForYouHub, type ForYouRoute } from './ForYouHub';
import { type ProfileTabs, type ProfileTabSpec, routesOf } from './profileTabs';

/** Every hash our profile tabs answer to. */
export type ProfileRoute = 'crate-mates' | ForYouRoute;

interface ViewProps<Route extends ProfileRoute> {
  route: Route;
  openRoute: (route: Route) => void;
}

interface ProfileTab<Route extends ProfileRoute> extends ProfileTabSpec<Route> {
  View: ComponentType<ViewProps<Route>>;
}

const CRATE_MATES: ProfileTab<'crate-mates'> = {
  id: 'crate-mates',
  label: 'crate mates',
  View: CrateMatesTab,
};
// Picks, crate mates' latest and new from follows share one tab, so Bandcamp's bar stays short.
const FOR_YOU: ProfileTab<ForYouRoute> = {
  id: 'for-you',
  label: 'for you',
  routes: ['latest', 'follows'],
  View: ForYouHub,
};

/** Our tabs on your profile, in order after Bandcamp's own. A new tab is one more entry here and in RouteView. */
export const PROFILE_TABS: readonly ProfileTabSpec<ProfileRoute>[] = [CRATE_MATES, FOR_YOU];

/** Sets the hash, which the tab store follows; Back and Forward step through routes. */
function openRoute(route: ProfileRoute): void {
  window.location.hash = route;
}

/** The profile checks the queue's health as rarely as the sidebar does. */
const SCANNER_POLL_MS = 5000;

/** Shows the open route's view. Views mount on open, so each opening loads fresh data. */
export function ProfileApp({ tabs }: { tabs: ProfileTabs<ProfileRoute> }) {
  const route = useSyncExternalStore(tabs.subscribe, tabs.getActive);
  if (route === null) return null;
  return (
    <section className="dh-profile" aria-label={`Dighead: ${labelOf(route)}`}>
      <ScannerNotices />
      <RouteView route={route} />
    </section>
  );
}

function labelOf(route: ProfileRoute): string {
  return PROFILE_TABS.find((tab) => routesOf(tab).includes(route))?.label ?? '';
}

function RouteView({ route }: { route: ProfileRoute }) {
  if (route === 'crate-mates') return <CRATE_MATES.View route={route} openRoute={openRoute} />;
  return <FOR_YOU.View route={route} openRoute={openRoute} />;
}

/** Mounted only while one of our tabs is open, so a closed tab doesn't poll. */
function ScannerNotices() {
  const notices = useScannerNotices(SCANNER_POLL_MS);
  return (
    notices.length > 0 && (
      <div className="dh-profile__notice">
        <NoticeStack notices={notices} />
      </div>
    )
  );
}
