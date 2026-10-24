// Desktop notifications for new releases from your follows (decisions §22, research #10). Off by
// default; `notifications` is an optional permission the popup asks for when you turn them on.

import { countJobs, db, getMe } from '../../db';
import { fanPageUrl } from '../../bandcamp';
import { loadSettings } from '../../shared/settings';
import { followsDigestEntries } from './digest';
import { followsNotification } from './notification';
import { chromeFollowsStore } from './state';

const NOTIFICATION_ID = 'dighead-follows';
/** The profile tab the notification opens. */
const FOLLOWS_TAB_HASH = '#follows';

async function permitted(): Promise<boolean> {
  return chrome.permissions.contains({ permissions: ['notifications'] });
}

/**
 * After a band read: once the round of reads is over, one notification for what it found.
 * Sent at the end of the round so a week's finds arrive together, not one by one.
 */
export async function notifyWhenRoundEnds(): Promise<void> {
  if ((await countJobs(db)).followReleases > 0) return;
  const [settings, me, state] = await Promise.all([
    loadSettings(),
    getMe(db),
    chromeFollowsStore.load(),
  ]);
  if (!settings.followNotifications || !me || !(await permitted())) return;
  const { entries } = await followsDigestEntries(db, me, settings.topCrateMatesK, Date.now());
  const notification = followsNotification(entries, state);
  if (!notification) return;
  chrome.notifications.create(NOTIFICATION_ID, {
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icons/icon-128.png'),
    title: notification.title,
    message: notification.message,
  });
  await chromeFollowsStore.save({ lastNotifiedAt: Date.now() });
}

async function openFollowsTab(id: string): Promise<void> {
  if (id !== NOTIFICATION_ID) return;
  chrome.notifications.clear(id);
  const me = await getMe(db);
  const url = me ? `${fanPageUrl(me.username)}${FOLLOWS_TAB_HASH}` : 'https://bandcamp.com/';
  await chrome.tabs.create({ url });
}

let listening = false;

/**
 * Opens the tab when the notification is clicked. The API only exists once the permission is
 * granted, so this runs at startup and again when it's granted.
 */
export function listenForNotificationClicks(): void {
  if (listening || !chrome.notifications) return;
  listening = true;
  chrome.notifications.onClicked.addListener((id) => {
    openFollowsTab(id).catch((error: unknown) =>
      console.error('dighead: could not open the follows tab', error),
    );
  });
}
