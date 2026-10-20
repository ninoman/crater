import type { MessageHandlers } from '../shared/messages';
import { getSyncStatus, onPageSeen, startSync } from './meSync';
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
  releaseOpened: ({ itemKey, url }) => openRelease(itemKey, url),
  getScannerStatus: () => getScannerStatus(),
};
