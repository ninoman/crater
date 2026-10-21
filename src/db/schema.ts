// IndexedDB schema, owned by the service worker. Settings live in chrome.storage, not here.

import Dexie, { type EntityTable, type Table } from 'dexie';
import type { ItemKey } from '../bandcamp';
import { buildMatchIndex } from './matchIndex';

export interface ItemRecord {
  itemKey: ItemKey;
  albumKey: ItemKey | null;
  title: string;
  artist: string;
  /** Selling account: the artist's own, or a label's (decisions §3.3). */
  bandId: number;
  /** Set when the release is on a label but sold from the artist's account. From collection pages. */
  label: string | null;
  labelId: number | null;
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
  /** Last time a supporter list or a scan showed this fan. Long-unseen fans are forgotten. */
  lastSeenAt: number;
}

export interface OwnershipRecord {
  fanId: number;
  itemKey: ItemKey;
  /** albumKey ?? itemKey: what overlap is computed on (decisions §3.8). */
  matchKey: ItemKey;
  source: 'collection' | 'wishlist';
  addedAt: number | null;
}

/**
 * A fan's distinct collection matchKeys, kept in step with their `ownership` rows. Scoring reads
 * these compact lists instead of every ownership row (decisions §6).
 */
export interface FanMatchesRecord {
  fanId: number;
  /** matchKeys as numbers (keyToNumber), sorted ascending. */
  matchIds: Float64Array;
  /** Newest purchase time (ms) under each of `matchIds`, in the same order. 0 when unknown. */
  matchTimes: Float64Array;
}

/** How many fans' collections hold a matchKey: the base rate for lift (decisions §6). */
export interface MatchOwnersRecord {
  /** keyToNumber(matchKey) */
  matchId: number;
  owners: number;
}

/** A release you hid from recommendations. Keyed by matchKey, so it hides tracks of it too. */
export interface HiddenRecord {
  matchKey: ItemKey;
  hiddenAt: number;
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
  /** In step with your recent buying (decisions §11). Null when either of you bought too little lately. */
  lately: number | null;
  /** `lately` as it stood a year ago, for the trend. */
  yearAgo: number | null;
  /** Releases you both bought within the last year. */
  latelyOverlap: number;
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

/** Bandcamp has no label flag: artists and labels are both band accounts (decisions §8). */
export type FollowKind = 'fan' | 'band';
export type FollowingKey = [kind: FollowKind, id: number];

/** An account you follow, from your own sync. Only followings can be tagged (decisions §8). */
export interface FollowingRecord {
  kind: FollowKind;
  /** fan_id or band_id. */
  id: number;
  name: string;
  /** A fan's profile, or a band's subdomain or custom domain. */
  url: string;
  imageId: number | null;
  location: string | null;
  followedAt: number;
  tagIds: number[];
  /** Unfollowed on the tab since the last sync. Keeps its tags until a full sync deletes it. */
  unfollowed: boolean;
}

export interface TagRecord {
  /** Auto-incremented, so optional only when adding. */
  id: number;
  name: string;
  /** The trimmed, lowercased name. Unique, so "Ambient" and "ambient " are one tag. */
  nameKey: string;
}

/** Blanks the v6 fields on a twin stored before them, until the next recompute fills them. */
export function blankLately(twin: TwinRecord): void {
  twin.lately ??= null;
  twin.yearAgo ??= null;
  twin.latelyOverlap ??= 0;
}

/** Tables newer than the oldest restorable backup, by the version that added them. */
export const TABLES_ADDED: Readonly<Record<string, number>> = { latelyTwins: 6 };

export class DigheadDb extends Dexie {
  items!: EntityTable<ItemRecord, 'itemKey'>;
  fans!: EntityTable<FanRecord, 'fanId'>;
  ownership!: Table<OwnershipRecord, [number, ItemKey]>;
  releaseSupporters!: EntityTable<ReleaseSupportersRecord, 'itemKey'>;
  me!: EntityTable<MeRecord, 'id'>;
  twins!: EntityTable<TwinRecord, 'fanId'>;
  /** The leaderboard by `lately` rather than `score`: the fans most in step with you now. */
  latelyTwins!: EntityTable<TwinRecord, 'fanId'>;
  queue!: EntityTable<QueueJob, 'id'>;
  fanMatches!: EntityTable<FanMatchesRecord, 'fanId'>;
  matchOwners!: EntityTable<MatchOwnersRecord, 'matchId'>;
  hidden!: EntityTable<HiddenRecord, 'matchKey'>;
  following!: Table<FollowingRecord, FollowingKey>;
  tags!: EntityTable<TagRecord, 'id'>;

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
    // v3: labels on items, the match index scoring reads (decisions §6) and hidden releases.
    this.version(3)
      .stores({
        items: 'itemKey, bandId, albumKey, labelId',
        fanMatches: 'fanId',
        matchOwners: 'matchId',
        hidden: 'matchKey',
      })
      .upgrade(async (tx) => {
        await tx
          .table<ItemRecord>('items')
          .toCollection()
          .modify((item) => {
            item.label ??= null;
            item.labelId ??= null;
          });
        const index = buildMatchIndex(await tx.table<OwnershipRecord>('ownership').toArray());
        await tx.table('fanMatches').bulkPut(index.fanMatches);
        await tx.table('matchOwners').bulkPut(index.matchOwners);
      });
    // v4: when each fan was last seen, for forgetting long-unseen fans (decisions §9).
    this.version(4)
      .stores({ fans: 'fanId, status, collectionFetchedAt, lastSeenAt' })
      .upgrade(async (tx) => {
        const now = Date.now();
        await tx
          .table<FanRecord>('fans')
          .toCollection()
          .modify((fan) => {
            fan.lastSeenAt ??= fan.collectionFetchedAt ?? now;
          });
      });
    // v5: followings and your tags on them (decisions §8). New tables, so nothing to migrate.
    this.version(5).stores({
      following: '[kind+id], kind, *tagIds',
      tags: '++id, &nameKey',
    });
    // v6: purchase times in the match index and a second leaderboard for recent taste (§11).
    // Restoring a v5 backup does the same (backup.ts), so keep the two in step.
    this.version(6)
      .stores({ latelyTwins: 'fanId, lately' })
      .upgrade(async (tx) => {
        const index = buildMatchIndex(await tx.table<OwnershipRecord>('ownership').toArray());
        await tx.table('fanMatches').clear();
        await tx.table('fanMatches').bulkPut(index.fanMatches);
        await tx.table<TwinRecord>('twins').toCollection().modify(blankLately);
      });
  }
}
