// IndexedDB schema, owned by the service worker. Settings live in chrome.storage, not here.

import Dexie, { type EntityTable, type Table } from 'dexie';
import type { ItemKey } from '../bandcamp';

export interface ItemRecord {
  itemKey: ItemKey;
  albumKey: ItemKey | null;
  title: string;
  artist: string;
  /** Selling account; the label proxy (decisions §3.3). */
  bandId: number;
  url: string;
  artId: number | null;
  /** Only known once the release page itself has been parsed. */
  tags: string[];
  /** also_collected_count + 1 (decisions §3.2). */
  supporterCount: number | null;
  fetchedAt: number;
}

export type FanStatus = 'queued' | 'partial' | 'done' | 'private' | 'error';

export interface FanRecord {
  fanId: number;
  username: string;
  name: string;
  imageId: number | null;
  /** Unknown until the last collection page, since scans skip the profile page. */
  collectionSize: number | null;
  scannedItems: number;
  collectionFetchedAt: number | null;
  status: FanStatus;
}

export interface OwnershipRecord {
  fanId: number;
  itemKey: ItemKey;
  /** albumKey ?? itemKey: what overlap is computed on (decisions §3.8). */
  matchKey: ItemKey;
  source: 'collection' | 'wishlist';
  addedAt: number | null;
}

export interface ReleaseSupportersRecord {
  itemKey: ItemKey;
  /** In page order: most recent first, capped by settings.supportersPerReleaseCap. */
  fanIds: number[];
  fetchedAt: number;
}

/** The logged-in user. Owned and wishlisted items are their rows in `ownership`. */
export interface MeRecord {
  id: 'self';
  fanId: number;
  username: string;
  syncedAt: number | null;
}

export interface TwinRecord {
  fanId: number;
  overlap: number;
  jaccard: number;
  score: number;
  labelCluster: boolean;
  computedAt: number;
}

/** Where a release job carries on paging supporters. A null token means that list is done. */
export interface ReleaseCursor {
  thumbsToken: string | null;
  reviewsToken: string | null;
  /** Supporters saved so far, checked against settings.supportersPerReleaseCap. */
  collected: number;
}

/** Where a fan job carries on paging the collection. */
export interface FanCursor {
  token: string;
  scanned: number;
}

interface JobBase {
  id?: number;
  /** Lower runs first. */
  priority: number;
  /** Failed runs so far, for errors that aren't Bandcamp's fault (see scanner/outcome.ts). */
  attempts: number;
  nextAttemptAt: number;
}

/** Fetches a release page, then pages its supporters. One request per run. */
export interface ReleaseJob extends JobBase {
  kind: 'release';
  target: ItemKey;
  url: string;
  cursor: ReleaseCursor | null;
}

/** Pages one fan's collection. One request per run. */
export interface FanJob extends JobBase {
  kind: 'fan';
  /** The fanId, as a string so `[kind+target]` stays one key type. */
  target: `${number}`;
  cursor: FanCursor | null;
}

export type QueueJob = ReleaseJob | FanJob;
export type JobKind = QueueJob['kind'];

export class DigheadDb extends Dexie {
  items!: EntityTable<ItemRecord, 'itemKey'>;
  fans!: EntityTable<FanRecord, 'fanId'>;
  ownership!: Table<OwnershipRecord, [number, ItemKey]>;
  releaseSupporters!: EntityTable<ReleaseSupportersRecord, 'itemKey'>;
  me!: EntityTable<MeRecord, 'id'>;
  twins!: EntityTable<TwinRecord, 'fanId'>;
  queue!: EntityTable<QueueJob, 'id'>;

  constructor(name = 'dighead') {
    super(name);
    // Never edit a released version: add a new this.version(n) with an upgrade instead.
    this.version(1).stores({
      items: 'itemKey, bandId, albumKey',
      fans: 'fanId, status, collectionFetchedAt',
      ownership: '[fanId+itemKey], fanId, itemKey, matchKey',
      releaseSupporters: 'itemKey',
      me: 'id',
      twins: 'fanId, score',
      queue: '++id, &[kind+target], [priority+nextAttemptAt]',
    });
    // v2: supporters indexed by fan (for progress), and jobs with a url and a cursor.
    // Phases 1-2 never enqueued anything, so there are no old-shape jobs worth migrating.
    this.version(2)
      .stores({ releaseSupporters: 'itemKey, *fanIds' })
      .upgrade((tx) => tx.table('queue').clear());
  }
}
