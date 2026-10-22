// Typed message bus between UI surfaces (content script, popup) and the service worker.
// Add a message by extending MessageMap; both sides get checked types for free.
// Worker-to-tab events go the other way and are listed in EventMap.

import type { ItemKey, ReleasePageItem, ReleasePreview, Viewer } from '../bandcamp';
import type { AlsoBoughtResult } from './alsoBought';
import type { BackupSummary, ImportNotice } from './backupFile';
import type { ForYouMode, ForYouResult } from './forYou';
import type {
  Following,
  FollowingKey,
  FollowKind,
  Tag,
  TagAction,
  TagBackup,
  TagImportSummary,
  TagMode,
  TagResult,
} from './following';
import type { PageBadge, ReleaseRef } from './pageBadges';
import type { ReleaseTwinsResult } from './releaseTwins';
import type { QueueReleaseStatus, ScannerStatus, ScanProgress } from './scan';
import type { SyncStatus } from './sync';
import type { TwinsResult, TwinStanding } from './twins';
import type { WishlistItem } from './wishlist';
import type { TwinsLatestResult } from './twinsLatest';

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
  /** Scans a release's supporters on request, at background priority, so the dataset grows where you want. */
  queueRelease: {
    request: { itemKey: ItemKey; url: string };
    response: { status: QueueReleaseStatus };
  };
  getScannerStatus: { request: NoPayload; response: ScannerStatus };
  /** Scores Also bought for a release from what's in the database now. */
  getAlsoBought: { request: { itemKey: ItemKey }; response: AlsoBoughtResult };
  /** A release's streamable tracks, read fresh from its page because stream URLs expire. */
  getPreview: { request: { url: string }; response: ReleasePreview };
  /** Never recommend this release again, in any list. */
  hideRelease: { request: { matchKey: ItemKey }; response: null };
  /** The taste-twins leaderboard as last computed, with the fans' names and avatars. */
  getTwins: { request: NoPayload; response: TwinsResult };
  /** Releases your top twins own and you don't, for the For you tab on your profile. */
  getForYou: { request: { mode: ForYouMode }; response: ForYouResult };
  /** What your top twins bought lately that you don't own, for Twins' latest on your profile. */
  getTwinsLatest: { request: NoPayload; response: TwinsLatestResult };
  /** Where a fan stands on your leaderboard, or null if they aren't on it. */
  getTwinStanding: { request: { fanId: number }; response: TwinStanding | null };
  /** `getTwinStanding` for many fans in one board read. Fans not on the board are left out. */
  getTwinStandings: {
    request: { fanIds: number[] };
    response: Record<number, TwinStanding>;
  };
  /** Badges for a page's release links, one per link in order; null for an unknown release. */
  getPageBadges: { request: { links: ReleaseRef[] }; response: (PageBadge | null)[] };
  /** Your taste twins who own a release, for the sidebar's "Twins who own this" tab. */
  getReleaseTwins: { request: { itemKey: ItemKey }; response: ReleaseTwinsResult };
  /** Your tags, by name. */
  listTags: { request: NoPayload; response: Tag[] };
  /** A name that already exists answers with that tag. */
  createTag: { request: { name: string }; response: TagResult };
  renameTag: { request: { id: number; name: string }; response: TagResult };
  /** Also takes the tag off every following and wishlist item. */
  deleteTag: { request: { id: number }; response: null };
  /** Adds a tag to, or removes it from, many followings at once. Answers with how many changed. */
  assignTag: {
    request: { tagId: number; keys: FollowingKey[]; action: TagAction };
    response: number;
  };
  /** Followings of one kind passing the tag filter, newest first. No tags selected keeps all. */
  listFollowing: {
    request: { kind: FollowKind; tagIds: number[]; mode: TagMode };
    response: Following[];
  };
  /** The tag ids on an account you follow, or null when you don't follow it. */
  getFollowTags: {
    request: { kind: FollowKind; id: number };
    response: number[] | null;
  };
  /** Marks or clears an unfollow made on the tab. */
  setUnfollowed: {
    request: { key: FollowingKey; unfollowed: boolean };
    response: null;
  };
  /** Your wishlist with your tags, newest first. Empty before your first sync. */
  listWishlist: { request: NoPayload; response: WishlistItem[] };
  /** The tag ids on an item in your wishlist, or null when it isn't in your wishlist. */
  getItemTags: { request: { itemKey: ItemKey }; response: number[] | null };
  /** Adds a tag to, or removes it from, many wishlist items at once. Answers with how many changed. */
  assignItemTag: {
    request: { tagId: number; itemKeys: ItemKey[]; action: TagAction };
    response: number;
  };
  exportTags: { request: NoPayload; response: TagBackup };
  importTags: { request: { backup: TagBackup }; response: TagImportSummary };
  /** Writes a full backup to the staging file (shared/backupStaging.ts); the popup saves it. */
  exportBackup: { request: NoPayload; response: BackupSummary };
  /** Replaces the whole database with the staged file the popup wrote. */
  importBackup: { request: NoPayload; response: BackupSummary };
  /** What startup recovery did about an interrupted import, until dismissed. */
  getImportNotice: { request: NoPayload; response: ImportNotice | null };
  dismissImportNotice: { request: NoPayload; response: null };
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
