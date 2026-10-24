// Typed message bus between UI surfaces (content script, popup) and the service worker.
// Add a message by extending MessageMap; both sides get checked types for free.
// Worker-to-tab events go the other way and are listed in EventMap.

import type { ItemKey, ReleasePageItem, ReleasePreview, Viewer } from '../bandcamp';
import type { AlsoBoughtResult } from './alsoBought';
import type { BackupSummary, ImportNotice } from './backupFile';
import type { ForYouMode, ForYouResult } from './forYou';
import type { HeardSource } from './heard';
import type { HiddenEntry, HideTarget } from './hide';
import type { ListFilters } from './listFilters';
import type {
  Following,
  FollowingKey,
  FollowKind,
  SyncedFollowing,
  Tag,
  TagAction,
  TagBackup,
  TagImportSummary,
  TagMode,
  TagResult,
} from './following';
import type { PageBadge, ReleaseRef } from './pageBadges';
import type { ReleaseCrateMatesResult } from './releaseCrateMates';
import type { QueueReleaseStatus, ScannerStatus, ScanProgress } from './scan';
import type { SyncStatus } from './sync';
import type { CrateMatesResult, CrateMateStanding } from './crateMates';
import type { ItemNote, ListedItem, ListSource } from './itemList';
import type { CrateMatesLatestResult } from './crateMatesLatest';
import type { FollowsDigestResult, FollowsDigestVisit } from './followsDigest';

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
  getAlsoBought: {
    request: { itemKey: ItemKey; hideHeard: boolean; filters?: ListFilters };
    response: AlsoBoughtResult;
  };
  /** A release's streamable tracks, read fresh from its page because stream URLs expire. */
  getPreview: { request: { url: string }; response: ReleasePreview };
  // Hide from recommendations and heard it (decisions §22).
  /** Never recommend this release, artist or label again, in any list. */
  hide: { request: { target: HideTarget }; response: null };
  /** Undoes a hide, from the popup's Hidden list. */
  unhide: { request: { target: HideTarget }; response: null };
  /** Everything hidden, newest first. */
  listHidden: { request: NoPayload; response: HiddenEntry[] };
  /** A play past the threshold, or a manual mark. A track of an album marks the album. */
  markHeard: { request: { itemKey: ItemKey; source: HeardSource }; response: null };
  unmarkHeard: { request: { matchKey: ItemKey }; response: null };
  /** The crate-mates leaderboard as last computed, with the fans' names and avatars. */
  getCrateMates: { request: NoPayload; response: CrateMatesResult };
  /** Releases your top crate mates own and you don't, for the For you tab on your profile. */
  getForYou: {
    request: { mode: ForYouMode; hideHeard: boolean; filters?: ListFilters };
    response: ForYouResult;
  };
  /** What your top crate mates bought lately that you don't own, for Crate mates' latest on your profile. */
  getCrateMatesLatest: {
    request: { hideHeard: boolean; filters?: ListFilters };
    response: CrateMatesLatestResult;
  };
  /** Where a fan stands on your leaderboard, or null if they aren't on it. */
  getCrateMateStanding: { request: { fanId: number }; response: CrateMateStanding | null };
  /** `getCrateMateStanding` for many fans in one board read. Fans not on the board are left out. */
  getCrateMateStandings: {
    request: { fanIds: number[] };
    response: Record<number, CrateMateStanding>;
  };
  /** Badges for a page's release links, one per link in order; null for an unknown release. */
  getPageBadges: { request: { links: ReleaseRef[] }; response: (PageBadge | null)[] };
  /** Your crate mates who own a release, for the sidebar's "Crate mates who own this" tab. */
  getReleaseCrateMates: { request: { itemKey: ItemKey }; response: ReleaseCrateMatesResult };
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
  /** A follow made on an account's own page, before the next sync lists it (decisions §21). */
  markFollowed: { request: { account: SyncedFollowing }; response: null };
  /** Marks or clears an unfollow made on the tab or on the account's page. */
  setUnfollowed: {
    request: { key: FollowingKey; unfollowed: boolean };
    response: null;
  };
  /**
   * Your wishlist or collection with your tags, notes and (wishlist) prices, newest first.
   * Empty before your first sync.
   */
  listItems: { request: { source: ListSource }; response: ListedItem[] };
  /** The tag ids on an item in your wishlist, or null when it isn't in your wishlist. */
  getItemTags: { request: { itemKey: ItemKey }; response: number[] | null };
  /** Adds a tag to, or removes it from, many wishlist items at once. Answers with how many changed. */
  assignItemTag: {
    request: { tagId: number; itemKeys: ItemKey[]; action: TagAction };
    response: number;
  };
  /**
   * A heart clicked on a release page, before the next sync sees it. Answers false when we
   * don't know who you are yet, so there's nothing to tag.
   */
  markWishlisted: {
    request: { release: Pick<ReleasePageItem, 'itemKey' | 'albumKey'> };
    response: boolean;
  };
  markUnwishlisted: { request: { itemKey: ItemKey }; response: null };
  /** Saves your note and rating on an item, or deletes them when both are empty. Answers what was kept. */
  saveItemNote: { request: { itemKey: ItemKey; note: ItemNote }; response: ItemNote | null };
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
  // New from your follows (decisions §23).
  /** The digest, with rows found after `previousVisitAt` marked new, heard ones left out if asked. */
  getFollowsDigest: {
    request: { previousVisitAt: number | null; hideHeard: boolean };
    response: FollowsDigestResult;
  };
  /** The tab opened: records the visit, and reads your follows' releases next. */
  followsDigestOpened: { request: NoPayload; response: FollowsDigestVisit };
  /** Hides an account's releases from the digest and notifications, or brings them back. */
  setFollowMute: { request: { bandId: number; muted: boolean }; response: null };
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
  /** Sent with `alsoBought`: the crate mates owning that release, after the same scans. */
  releaseCrateMates: ReleaseCrateMatesResult;
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
