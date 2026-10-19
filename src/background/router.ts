import type { MessageHandlers } from '../shared/messages';

export const handlers: MessageHandlers = {
  ping: () => ({ version: chrome.runtime.getManifest().version }),
};
