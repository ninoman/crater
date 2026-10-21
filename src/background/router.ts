import { fetchReleasePreview } from '../bandcamp';
import { db, hideRelease } from '../db';
import type { MessageHandlers } from '../shared/messages';
import { backupHandlers } from './backupHandlers';
import { followingHandlers } from './followingHandlers';
import { fetchText } from './http';
import { getSyncStatus, onPageSeen, startSync } from './meSync';
import {
  getAlsoBought,
  getForYou,
  getReleaseTwins,
  getTwinStanding,
  getTwinStandings,
  readTwinsResult,
} from './recommend';
import {
  clearScanData,
  getScannerStatus,
  openRelease,
  pauseScanner,
  requestRelease,
  resumeScanner,
} from './scanner';

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
  getTwins: () => readTwinsResult(db),
  getTwinStanding: ({ fanId }) => getTwinStanding(db, fanId),
  getTwinStandings: ({ fanIds }) => getTwinStandings(db, fanIds),
  getReleaseTwins: ({ itemKey }) => getReleaseTwins(itemKey),
  getForYou: () => getForYou(),
  ...followingHandlers(db),
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
