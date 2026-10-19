// Typed message bus between UI surfaces (content script, popup) and the service worker.
// Add a message by extending MessageMap; both sides get checked types for free.

import type { Viewer } from '../bandcamp';
import type { SyncStatus } from './sync';

type NoPayload = Record<string, never>;

export interface MessageMap {
  ping: { request: NoPayload; response: { version: string } };
  /** Sent by the content script on every Bandcamp page. */
  pageSeen: {
    request: { viewer: Viewer | null; purchaseConfirmation: boolean };
    response: null;
  };
  getSyncStatus: { request: NoPayload; response: SyncStatus };
  /** Full re-sync of your collection and wishlist, from the popup. */
  resync: { request: NoPayload; response: null };
}

export type MessageType = keyof MessageMap;
export type MessageRequest<K extends MessageType> = MessageMap[K]['request'];
export type MessageResponse<K extends MessageType> = MessageMap[K]['response'];

interface Envelope<K extends MessageType> {
  type: K;
  payload: MessageRequest<K>;
}

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

export type MessageHandlers = {
  [K in MessageType]: (
    payload: MessageRequest<K>,
    sender: chrome.runtime.MessageSender,
  ) => Promise<MessageResponse<K>> | MessageResponse<K>;
};

export async function sendMessage<K extends MessageType>(
  type: K,
  payload: MessageRequest<K>,
): Promise<MessageResponse<K>> {
  const envelope: Envelope<K> = { type, payload };
  const result = (await chrome.runtime.sendMessage(envelope)) as Result<MessageResponse<K>>;
  if (!result.ok) throw new Error(result.error);
  return result.data;
}

/** Registers handlers in the service worker. Errors are returned to the sender, not thrown. */
export function listenForMessages(handlers: MessageHandlers): void {
  chrome.runtime.onMessage.addListener((message: Envelope<MessageType>, sender, sendResponse) => {
    const handler = handlers[message.type] as
      ((payload: unknown, sender: chrome.runtime.MessageSender) => unknown) | undefined;
    if (!handler) return false;
    Promise.resolve()
      .then(() => handler(message.payload, sender))
      .then(
        (data) => sendResponse({ ok: true, data }),
        (error: unknown) => sendResponse({ ok: false, error: String(error) }),
      );
    return true; // keep the channel open for the async response
  });
}
