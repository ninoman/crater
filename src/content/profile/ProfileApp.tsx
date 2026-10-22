import { useSyncExternalStore, type ComponentType } from 'react';
import { useScannerNotices } from '../../hooks/useScannerNotices';
import { NoticeStack } from '../../ui';
import { ForYouTab } from './forYou/ForYouTab';
import { LatestTab } from './latest/LatestTab';
import type { ProfileTabs, ProfileTabSpec } from './profileTabs';
import { CrateMatesTab } from './crateMates/CrateMatesTab';

interface ProfileTab<Id extends string> extends ProfileTabSpec<Id> {
  View: ComponentType;
}

/** Our tabs on your profile, in order after Bandcamp's own. A new tab is one more entry here. */
export const PROFILE_TABS = [
  { id: 'crate-mates', label: 'crate mates', View: CrateMatesTab },
  { id: 'for-you', label: 'for you', View: ForYouTab },
  { id: 'latest', label: "mates' latest", View: LatestTab },
] as const satisfies readonly ProfileTab<string>[];

export type ProfileTabId = (typeof PROFILE_TABS)[number]['id'];

/** The profile checks the queue's health as rarely as the sidebar does. */
const SCANNER_POLL_MS = 5000;

/** Shows the open tab's view. Views mount on open, so each opening loads fresh data. */
export function ProfileApp({ tabs }: { tabs: ProfileTabs<ProfileTabId> }) {
  const active = useSyncExternalStore(tabs.subscribe, tabs.getActive);
  const tab = PROFILE_TABS.find(({ id }) => id === active);
  if (!tab) return null;
  return (
    <section className="dh-profile" aria-label={`Dighead: ${tab.label}`}>
      <ScannerNotices />
      <tab.View />
    </section>
  );
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
