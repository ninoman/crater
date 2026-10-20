// Typed message bus between UI surfaces (content script, popup) and the service worker.
// Add a message by extending MessageMap; both sides get checked types for free.
// Worker-to-tab events go the other way and are listed in EventMap.

import type { ItemKey, ReleasePageItem, Viewer } from '../bandcamp';
import type { AlsoBoughtResult } from './alsoBought';
import type { ForYouResult } from './forYou';
import type { ReleaseTwinsResult } from './releaseTwins';
import type { ScannerStatus, ScanProgress } from './scan';
import type { SyncStatus } from './sync';
import type { TwinsResult } from './twins';

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
  /**
   * A release page opened: save what the page says about it and scan its supporters first.
   * Answers with the progress so far.
   */
  releaseOpened: { request: { item: ReleasePageItem }; response: ScanProgress };
  getScannerStatus: { request: NoPayload; response: ScannerStatus };
  /** Scores Also bought for a release from what's in the database now. */
  getAlsoBought: { request: { itemKey: ItemKey }; response: AlsoBoughtResult };
  /** Never recommend this release again, in any list. */
  hideRelease: { request: { matchKey: ItemKey }; response: null };
  /** The taste-twins leaderboard as last computed, with the fans' names and avatars. */
  getTwins: { request: NoPayload; response: TwinsResult };
  /** Releases your top twins own and you don't, for the For you tab on your profile. */
  getForYou: { request: NoPayload; response: ForYouResult };
  /** Your taste twins who own a release, for the sidebar's "Twins who own this" tab. */
  getReleaseTwins: { request: { itemKey: ItemKey }; response: ReleaseTwinsResult };
  /** Stops the scanner until resumed, from the popup. */
  pauseScanner: { request: NoPayload; response: null };
  resumeScanner: { request: NoPayload; response: null };
  /** Deletes everything Dighead has stored except settings. Your collection re-syncs on the next Bandcamp page. */
  clearAllData: { request: NoPayload; response: null };
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
      | ((payload: unknown, sender: chrome.runtime.MessageSender) => unknown)
      | undefined;
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

/** Events the worker pushes to Bandcamp tabs. */
export interface EventMap {
  scanProgress: ScanProgress;
  /** A watched release was re-scored. */
  alsoBought: AlsoBoughtResult;
  /** Sent with `alsoBought`: the twins owning that release, after the same scans. */
  releaseTwins: ReleaseTwinsResult;
}

export type EventType = keyof EventMap;

interface EventEnvelope<K extends EventType> {
  event: K;
  payload: EventMap[K];
}

function isEventEnvelope(message: unknown): message is EventEnvelope<EventType> {
  return typeof message === 'object' && message !== null && 'event' in message;
}

/** Sends an event to every open tab matching `urlPatterns`. Tabs without our script are skipped. */
export async function broadcastToTabs<K extends EventType>(
  urlPatterns: string[],
  event: K,
  payload: EventMap[K],
): Promise<void> {
  const envelope: EventEnvelope<K> = { event, payload };
  const tabs = await chrome.tabs.query({ url: urlPatterns });
  await Promise.all(
    tabs.map(async ({ id }) => {
      if (id === undefined) return;
      // A tab opened before the extension loaded has no listener; that's fine.
      await chrome.tabs.sendMessage(id, envelope).catch(() => undefined);
    }),
  );
}

/** Listens for one kind of worker event in a content script. Returns an unsubscribe function. */
export function onWorkerEvent<K extends EventType>(
  event: K,
  listener: (payload: EventMap[K]) => void,
): () => void {
  const handle = (message: unknown) => {
    if (isEventEnvelope(message) && message.event === event) {
      listener(message.payload as EventMap[K]);
    }
  };
  chrome.runtime.onMessage.addListener(handle);
  return () => chrome.runtime.onMessage.removeListener(handle);
}
