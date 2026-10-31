import { fetchReleasePreview } from '../bandcamp';
import { db } from '../db';
import type { MessageHandlers } from '../shared/messages';
import { loadSettings } from '../shared/settings';
import { backupHandlers } from './backupHandlers';
import { followingHandlers } from './followingHandlers';
import { hideHeardHandlers } from './hideHeardHandlers';
import { followsHandlers } from './follows/handlers';
import { fetchJson, fetchText } from './http';
import { getSyncStatus, onPageSeen, startSync } from './meSync';
import { getPageBadges } from './pageBadges';
import {
  getAlsoBought,
  getForYou,
  getReleaseCrateMates,
  getCrateMateStanding,
  getCrateMateStandings,
  getCrateMatesLatest,
  getCrateMatesResult,
} from './recommend';
import {
  clearScanData,
  getScannerStatus,
  openRelease,
  pauseScanner,
  requestRelease,
  resumeScanner,
} from './scanner';
import { itemListHandlers } from './itemListHandlers';

export const handlers: MessageHandlers = {
  ping: () => ({ version: chrome.runtime.getManifest().version }),
  pageSeen: async ({ viewer, purchaseConfirmation }) => {
    await onPageSeen(viewer, purchaseConfirmation);
    return null;
  },
  getSyncStatus: () => getSyncStatus(),
  resync: () => {
    void startSync('full');
    return null;
  },
  releaseOpened: ({ item }) => openRelease(item),
  queueRelease: ({ itemKey, url }) => requestRelease(itemKey, url),
  getScannerStatus: () => getScannerStatus(),
  getAlsoBought: ({ itemKey, hideHeard }) => getAlsoBought(itemKey, hideHeard),
  getPreview: ({ url }) => fetchReleasePreview(fetchText, url),
  ...hideHeardHandlers(db),
  getCrateMates: () => getCrateMatesResult(),
  getCrateMateStanding: ({ fanId }) => getCrateMateStanding(db, fanId),
  getCrateMateStandings: ({ fanIds }) => getCrateMateStandings(db, fanIds),
  getReleaseCrateMates: ({ itemKey }) => getReleaseCrateMates(itemKey),
  getPageBadges: ({ links }) => getPageBadges(db, links),
  getForYou: ({ mode, hideHeard }) => getForYou(mode, hideHeard),
  getCrateMatesLatest: ({ hideHeard }) => getCrateMatesLatest(hideHeard),
  ...followingHandlers(db),
  ...itemListHandlers(db, async () => (await loadSettings()).topCrateMatesK, fetchJson),
  ...backupHandlers(db),
  pauseScanner: async () => {
    await pauseScanner();
    return null;
  },
  resumeScanner: async () => {
    await resumeScanner();
    return null;
  },
  clearAllData: async () => {
    await clearScanData();
    return null;
  },
  ...followsHandlers(db),
};
