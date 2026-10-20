import { db, hideRelease } from '../db';
import type { MessageHandlers } from '../shared/messages';
import { getSyncStatus, onPageSeen, startSync } from './meSync';
import { getAlsoBought } from './recommend';
import { getScannerStatus, openRelease } from './scanner';

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
  getScannerStatus: () => getScannerStatus(),
  getAlsoBought: ({ itemKey }) => getAlsoBought(itemKey),
  hideRelease: async ({ matchKey }) => {
    await hideRelease(db, matchKey, Date.now());
    return null;
  },
};
