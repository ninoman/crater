import { mountFollowing } from '../following/mountFollowing';
import { mountShadow } from '../shared/mountShadow';
import profileCss from './Profile.css?inline';
import { PROFILE_TABS, ProfileApp } from './ProfileApp';
import { injectProfileTabs } from './profileTabs';

/** Adds our tabs to your own fan page, with their content under Bandcamp's tab bar, and takes
 * over Bandcamp's following tab. */
export function mountProfile(doc: Document): void {
  const tabs = injectProfileTabs(doc, PROFILE_TABS);
  if (tabs) mountShadow(tabs.contentSlot, <ProfileApp tabs={tabs} />, profileCss);
  mountFollowing(doc);
}
