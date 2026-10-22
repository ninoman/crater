import { fetchReleasePreview } from '../bandcamp';
import { db, hideRelease } from '../db';
import type { MessageHandlers } from '../shared/messages';
import { backupHandlers } from './backupHandlers';
import { followingHandlers } from './followingHandlers';
import { fetchText } from './http';
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
import { wishlistHandlers } from './wishlistHandlers';

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
  getAlsoBought: ({ itemKey }) => getAlsoBought(itemKey),
  getPreview: ({ url }) => fetchReleasePreview(fetchText, url),
  hideRelease: async ({ matchKey }) => {
    await hideRelease(db, matchKey, Date.now());
    return null;
  },
  getCrateMates: () => getCrateMatesResult(),
  getCrateMateStanding: ({ fanId }) => getCrateMateStanding(db, fanId),
  getCrateMateStandings: ({ fanIds }) => getCrateMateStandings(db, fanIds),
  getReleaseCrateMates: ({ itemKey }) => getReleaseCrateMates(itemKey),
  getPageBadges: ({ links }) => getPageBadges(db, links),
  getForYou: ({ mode }) => getForYou(mode),
  getCrateMatesLatest: () => getCrateMatesLatest(),
  ...followingHandlers(db),
  ...wishlistHandlers(db),
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
};
