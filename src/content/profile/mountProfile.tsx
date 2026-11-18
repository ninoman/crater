import { mountFollowing } from '../following/mountFollowing';
import { mountShadow } from '../shared/mountShadow';
import { TaggingProvider } from '../shared/tagging';
import { tagBarStyles } from '../shared/tagStyles';
import { mountItemList } from '../itemList/mountItemList';
import { COLLECTION, WISHLIST } from '../itemList/lists';
import profileCss from './Profile.css?inline';
import { PROFILE_TABS, ProfileApp } from './ProfileApp';
import { injectProfileTabs } from './profileTabs';

/**
 * Adds our tabs to your own fan page, with their content under Bandcamp's tab bar. Bandcamp's
 * following, wishlist and collection tabs are taken over only while tags are on: without them,
 * ours add too little over Bandcamp's own (decisions §31).
 */
export function mountProfile(doc: Document, tagging: boolean): void {
  const tabs = injectProfileTabs(doc, PROFILE_TABS);
  if (tabs) {
    mountShadow(
      tabs.contentSlot,
      <TaggingProvider value={tagging}>
        <ProfileApp tabs={tabs} />
      </TaggingProvider>,
      profileCss + tagBarStyles,
    );
  }
  if (!tagging) return;
  mountFollowing(doc);
  mountItemList(doc, WISHLIST);
  mountItemList(doc, COLLECTION);
}
