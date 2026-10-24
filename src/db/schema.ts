// IndexedDB schema, owned by the service worker. Settings live in chrome.storage, not here.

import Dexie, { type EntityTable, type Table } from 'dexie';
import { isCompilation, type ItemKey } from '../bandcamp';
import type { HeardSource } from '../shared/heard';
import { buildMatchIndex, fanMatchLists } from './matchIndex';
import { readItem, readOwnership, storeItem } from './storage';

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
  /** A compilation: scorers ignore or down-weight it (decisions §17). */
  compilation: boolean;
}

/** Everything about an item but its URL: what scoring reads, without looking up its band. */
export type ItemFields = Omit<ItemRecord, 'url'>;

/**
 * An item as `items` stores it (decisions §19): the URL split into its band's host and a slug,
 * and default values left out. Repos turn it back into an ItemRecord (itemStore.ts). Rows from
 * before v12 still have `url` and every field, and read the same way.
 */
export interface StoredItem {
  itemKey: ItemKey;
  title: string;
  artist: string;
  bandId: number;
  /** The path segment after /album/ or /track/. */
  slug?: string;
  /** Set when this item's host isn't its band's default. */
  host?: string;
  /** The whole URL, only when it doesn't split into host and slug. */
  url?: string;
  albumKey?: ItemKey | null;
  label?: string | null;
  labelId?: number | null;
  artId?: number | null;
  supporterCount?: number | null;
  tags?: string[];
  compilation?: boolean;
}

/**
 * The hosts a band's releases have been seen under: subdomains without `.bandcamp.com`, custom
 * domains whole. The first is the default; items under another one name it (decisions §19).
 */
export interface BandRecord {
  bandId: number;
  hosts: string[];
}

/**
 * `quick`: only the 100 items around their purchase of a release were read (decisions §12). Also
 * bought uses them; crate mates wait for the full scan, which is still queued.
 */
export type FanStatus = 'queued' | 'quick' | 'partial' | 'done' | 'private' | 'error';

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
  /** `collection_data.item_count` from their profile page (pass 1, decisions §12). */
  itemCount?: number;
  /**
   * Bandcamp's "N items in common" with you, from their profile page read signed in.
   * Null when the page was read logged out.
   */
  inCommon?: number | null;
}

export interface OwnershipRecord {
  fanId: number;
  itemKey: ItemKey;
  /** albumKey ?? itemKey: what overlap is computed on (decisions §3.8). */
  matchKey: ItemKey;
  source: 'collection' | 'wishlist';
  addedAt: number | null;
}

/** An ownership row as stored: `source` is left out for collection rows (decisions §19). */
export type StoredOwnership = Omit<OwnershipRecord, 'source'> & {
  source?: OwnershipRecord['source'];
};

/**
 * A fan's distinct collection matchKeys, kept in step with their `ownership` rows. Scoring reads
 * these compact lists instead of every ownership row (decisions §6). All lists hold keys as
 * numbers (keyToNumber), sorted ascending.
 */
export interface FanMatchesRecord {
  fanId: number;
  matchIds: Float64Array;
  /**
   * Tracks they own that belong to an album. Crate mate overlap needs them: two fans holding only
   * different tracks of one album don't match (decisions §7).
   */
  trackIds: Float64Array;
  /** The matchIds they hold only through tracks, not the album itself. */
  partialIds: Float64Array;
  /** Newest purchase time (ms) under each of `matchIds`, in the same order. 0 when unknown. */
  matchTimes: Float64Array;
}

/** How many fans' collections hold a matchKey: the base rate for lift (decisions §6). */
export interface MatchOwnersRecord {
  /** keyToNumber(matchKey) */
  matchId: number;
  owners: number;
}

/**
 * Something you hid from recommendations (decisions §22), keyed by `[kind+key]`. A release is
 * keyed by matchKey, so it hides tracks of it too. An artist or a label by its band account id,
 * with the name it had when hidden, for the Hidden list.
 */
export type HideRecord =
  | { kind: 'release'; key: ItemKey; hiddenAt: number }
  | { kind: 'band' | 'label'; key: number; name: string; hiddenAt: number };

/** A hidden release as stored up to v13, keyed by matchKey alone. */
export interface HiddenV13 {
  matchKey: ItemKey;
  hiddenAt: number;
}

/** A release you've heard (decisions §22). Keyed by matchKey, like hides. */
export interface HeardRecord {
  matchKey: ItemKey;
  heardAt: number;
  source: HeardSource;
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

export interface CrateMateRecord {
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

/**
 * Where a fan job carries on (decisions §12). No cursor yet: the profile page (pass 1) is next.
 * `quick`: one collection page around when they bought the release. `full`: paging the whole
 * collection. `latest`: a top lately crate mate's purchases since `since`, newest first (decisions
 * §11); a null token starts from the top.
 */
export type FanCursor =
  | { stage: 'quick' }
  | { stage: 'full'; token: string; scanned: number }
  | { stage: 'latest'; since: number; token: string | null; added: number };

interface JobBase {
  id?: number;
  /** Lower runs first. */
  priority: number;
  /**
   * Lower runs first among jobs with the same priority and place in line (`nextAttemptAt`):
   * how a release's supporters are ordered by expected overlap (decisions §12).
   */
  rank: number;
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
  /** The release whose supporter list queued them. Its purchase anchors the quick read. */
  via: ItemKey | null;
  cursor: FanCursor | null;
}

/**
 * Reads one followed band's releases (decisions §23). `details`: the releases whose URL is
 * still to be read, one request each, in order.
 */
export interface FollowReleasesJob extends JobBase {
  kind: 'followReleases';
  /** The band_id, as a string like a fan job's target. */
  target: `${number}`;
  cursor: { stage: 'details'; pending: ItemKey[] } | null;
}

export type QueueJob = ReleaseJob | FanJob | FollowReleasesJob;
export type JobKind = QueueJob['kind'];

/** Bandcamp has no label flag: artists and labels are both band accounts (decisions §8). */
export type FollowKind = 'fan' | 'band';
export type FollowingKey = [kind: FollowKind, id: number];

/** An account you follow, from your own sync. Taggable, like wishlist items (decisions §8, §14). */
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

/** Your tags on an item in your wishlist, keyed apart from `items`, which scans rewrite (§14). */
export interface ItemTagsRecord {
  itemKey: ItemKey;
  tagIds: number[];
}

export interface TagRecord {
  /** Auto-incremented, so optional only when adding. */
  id: number;
  name: string;
  /** The trimmed, lowercased name. Unique, so "Ambient" and "ambient " are one tag. */
  nameKey: string;
}

/**
 * A release of a band account you follow (decisions §23). The same release can be listed under
 * two accounts you follow, an artist and their label, so it's keyed by both.
 */
export interface BandReleaseRecord {
  /** The followed account whose discography lists it. */
  bandId: number;
  itemKey: ItemKey;
  /** The account selling it: `bandId` itself, or one of a label's artists. */
  sellerId: number;
  title: string;
  artist: string;
  artId: number | null;
  releasedAt: number | null;
  /** When a read of the band first listed it. */
  firstSeenAt: number;
  /** Listed by the band's first read, so it's back catalogue rather than news. */
  baseline: boolean;
  /** From the release's details; null until they're read. */
  url: string | null;
  albumKey: ItemKey | null;
  preorder: boolean;
}

/** When a followed band's releases were last read. */
export interface BandReadRecord {
  bandId: number;
  readAt: number;
}

/** A followed account whose releases you don't want in the digest or notifications. */
export interface FollowMuteRecord {
  bandId: number;
  mutedAt: number;
}

/** Blanks the v7 fields on a crate mate stored before them, until the next recompute fills them. */
export function blankLately(crateMate: CrateMateRecord): void {
  crateMate.lately ??= null;
  crateMate.yearAgo ??= null;
  crateMate.latelyOverlap ??= 0;
}

/** Gives a job from before v8 its rank, and a fan job its `via` and a staged cursor. */
export function upgradeJobToV8(job: QueueJob): void {
  job.rank ??= 0;
  if (job.kind !== 'fan') return;
  job.via ??= null;
  const cursor = job.cursor as FanCursor | { token: string; scanned: number } | null;
  if (cursor && !('stage' in cursor)) job.cursor = { stage: 'full', ...cursor };
}

/**
 * Flags an item stored before v11 from its artist and title. Track artists aren't stored, so
 * that rule waits for the release page's next fetch (decisions §17).
 */
export function flagCompilation(item: StoredItem): void {
  item.compilation ??= isCompilation(item);
}

/**
 * A hide row in the v14 shape. Rows from before it were releases keyed by matchKey; the Dexie
 * upgrade and importing an older backup both bring them through here.
 */
export function upgradeHide(row: HideRecord | HiddenV13): HideRecord {
  if ('kind' in row) return row;
  return { kind: 'release', key: row.matchKey, hiddenAt: row.hiddenAt };
}

/** Tables newer than the oldest restorable backup, by the version that added them. */
export const TABLES_ADDED: Readonly<Record<string, number>> = {
  latelyCrateMates: 7,
  itemTags: 9,
  bands: 12,
  heard: 14,
  bandReleases: 15,
  bandReads: 15,
  followMutes: 15,
};

/** Tables renamed since the oldest restorable backup: old name to new, as of `version`. */
export const TABLES_RENAMED: Readonly<Record<string, { to: string; version: number }>> = {
  twins: { to: 'crateMates', version: 13 },
  latelyTwins: { to: 'latelyCrateMates', version: 13 },
  // A new primary key, which Dexie can't change in place; rows go through upgradeHide.
  hidden: { to: 'hides', version: 14 },
};

export class DigheadDb extends Dexie {
  items!: EntityTable<StoredItem, 'itemKey'>;
  bands!: EntityTable<BandRecord, 'bandId'>;
  fans!: EntityTable<FanRecord, 'fanId'>;
  ownership!: Table<StoredOwnership, [number, ItemKey]>;
  releaseSupporters!: EntityTable<ReleaseSupportersRecord, 'itemKey'>;
  me!: EntityTable<MeRecord, 'id'>;
  crateMates!: EntityTable<CrateMateRecord, 'fanId'>;
  /** The leaderboard by `lately` rather than `score`: the fans most in step with you now. */
  latelyCrateMates!: EntityTable<CrateMateRecord, 'fanId'>;
  queue!: EntityTable<QueueJob, 'id'>;
  fanMatches!: EntityTable<FanMatchesRecord, 'fanId'>;
  matchOwners!: EntityTable<MatchOwnersRecord, 'matchId'>;
  hides!: Table<HideRecord, [HideRecord['kind'], HideRecord['key']]>;
  heard!: EntityTable<HeardRecord, 'matchKey'>;
  following!: Table<FollowingRecord, FollowingKey>;
  tags!: EntityTable<TagRecord, 'id'>;
  itemTags!: EntityTable<ItemTagsRecord, 'itemKey'>;
  bandReleases!: Table<BandReleaseRecord, [number, ItemKey]>;
  bandReads!: EntityTable<BandReadRecord, 'bandId'>;
  followMutes!: EntityTable<FollowMuteRecord, 'bandId'>;

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
    // v6: track lists on fanMatches, so crate mate overlap can tell tracks of one album apart (§7).
    this.version(6)
      .stores({})
      .upgrade((tx) => rebuildFanMatchLists(tx.table('fanMatches'), tx.table('ownership')));
    // v7: purchase times on fanMatches and a second leaderboard for recent taste (§11).
    // Importing an older backup does the same (migrateRows in backup.ts).
    this.version(7)
      .stores({ latelyTwins: 'fanId, lately' })
      .upgrade(async (tx) => {
        await rebuildFanMatchLists(tx.table('fanMatches'), tx.table('ownership'));
        await tx.table<CrateMateRecord>('twins').toCollection().modify(blankLately);
      });
    // v8: a rank tie-break in the queue and staged fan jobs (decisions §12). Every old job
    // gets rank 0, so the order stays as it was.
    this.version(8)
      .stores({ queue: '++id, &[kind+target], [priority+nextAttemptAt+rank]' })
      .upgrade((tx) => tx.table<QueueJob>('queue').toCollection().modify(upgradeJobToV8));
    // v9: your tags on wishlist items (decisions §14). A new table, so nothing to migrate.
    this.version(9).stores({ itemTags: 'itemKey, *tagIds' });
    // v10: items by url, so page badges find a release from a link (decisions §15). Index only.
    this.version(10).stores({ items: 'itemKey, bandId, albumKey, labelId, url' });
    // v11: compilations flagged on items (decisions §17). No index, only the flag to fill in.
    this.version(11)
      .stores({})
      .upgrade((tx) => tx.table<StoredItem>('items').toCollection().modify(flagCompilation));
    // v12: smaller rows and fewer indexes (decisions §19). Items keep a slug and their band its
    // hosts, replacing the `url` index; ownership loses its unused `fanId` and `itemKey` indexes.
    this.version(12)
      .stores({
        items: 'itemKey, bandId, albumKey, labelId',
        bands: 'bandId, *hosts',
        ownership: '[fanId+itemKey], matchKey',
      })
      .upgrade((tx) => slimToV12(tx.table('items'), tx.table('bands')));
    // v13: the twins leaderboards renamed to crate mates (decisions §20). Dexie drops the old
    // tables only after the upgrade has copied their rows.
    this.version(13)
      .stores({
        crateMates: 'fanId, score',
        latelyCrateMates: 'fanId, lately',
        twins: null,
        latelyTwins: null,
      })
      .upgrade(async (tx) => {
        for (const [from, { to, version }] of Object.entries(TABLES_RENAMED)) {
          if (version === 13) await tx.table(to).bulkPut(await tx.table(from).toArray());
        }
      });
    // v14: hides of whole artists and labels next to releases, and heard releases (§22). The
    // primary key changes, so `hidden` is copied into `hides` and dropped, as in v13.
    this.version(14)
      .stores({ hides: '[kind+key]', heard: 'matchKey', hidden: null })
      .upgrade(async (tx) => {
        const old = await tx.table<HiddenV13>('hidden').toArray();
        await tx.table('hides').bulkPut(old.map(upgradeHide));
      });
    // v15: releases of the bands you follow, when each was read, and your mutes (decisions §23).
    // New tables, so nothing to migrate.
    this.version(15).stores({
      bandReleases: '[bandId+itemKey], bandId, releasedAt, firstSeenAt',
      bandReads: 'bandId',
      followMutes: 'bandId',
    });
  }
}

/**
 * Recomputes every stored fanMatches record from its fan's ownership rows. Owner counts don't
 * change, since matchIds come out the same. Used by the v6 and v7 upgrades and by importing an
 * older backup.
 */
export async function rebuildFanMatchLists(
  fanMatches: EntityTable<FanMatchesRecord, 'fanId'>,
  ownership: Table<StoredOwnership, [number, ItemKey]>,
): Promise<void> {
  const fanIds = await fanMatches.toCollection().primaryKeys();
  for (const fanId of fanIds) {
    const rows = await ownership
      .where('[fanId+itemKey]')
      .between([fanId, Dexie.minKey], [fanId, Dexie.maxKey])
      .toArray();
    await fanMatches.put({ fanId, ...fanMatchLists(rows.map(readOwnership)) });
  }
}

/**
 * Rewrites items in the v12 shape (decisions §19): host and slug with defaults left out, and
 * each band's hosts in `bands`. The Dexie upgrade runs it, and so does importing an older backup
 * (migrateRows). Ownership rows aren't rewritten: reads take a stored 'collection' as written,
 * new rows leave it out, and rewriting 10⁶ rows made the upgrade take minutes.
 */
export async function slimToV12(
  items: EntityTable<StoredItem, 'itemKey'>,
  bands: EntityTable<BandRecord, 'bandId'>,
): Promise<void> {
  const known = new Map<number, BandRecord>();
  await items.toCollection().modify((row, ctx) => {
    const { stored, band } = storeItem(readItem(row, undefined), known.get(row.bandId));
    if (band) known.set(band.bandId, band);
    ctx.value = stored;
  });
  await bands.bulkPut([...known.values()]);
}
