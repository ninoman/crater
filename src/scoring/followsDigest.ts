// New from your follows (decisions §23): which releases of the accounts you follow are news, and
// in what order, newest first with a crate-mate interest signal. Pure, over plain data.

import { keyToNumber, matchKey, type ItemKey } from '../bandcamp';
import type { Exclusions, Seller } from './exclusions';

const DAY_MS = 24 * 60 * 60 * 1000;
/** How far back the digest goes, by when a release became news. */
export const DIGEST_WINDOW_DAYS = 60;
/**
 * A release first seen more than this long after its release date is an old release newly put
 * on Bandcamp, so it's news from when we saw it. Bands are read weekly, so a new release is
 * first seen up to about 8 days late.
 */
export const LATE_UPLOAD_MS = 14 * DAY_MS;

/** A release as a band read stored it. */
export interface FollowRelease {
  /** The followed account that lists it. */
  bandId: number;
  itemKey: ItemKey;
  sellerId: number;
  title: string;
  artist: string;
  artId: number | null;
  releasedAt: number | null;
  firstSeenAt: number;
  /** Listed by the account's first read: back catalogue, not news. */
  baseline: boolean;
  url: string | null;
  albumKey: ItemKey | null;
  preorder: boolean;
}

/**
 * When a release became news: its release date, unless it was put up long after that date (then
 * when we first saw it). Null for back catalogue without a date.
 */
export function newsAt(
  release: Pick<FollowRelease, 'releasedAt' | 'firstSeenAt' | 'baseline'>,
): number | null {
  const { releasedAt, firstSeenAt, baseline } = release;
  if (baseline) return releasedAt;
  if (releasedAt !== null && releasedAt >= firstSeenAt - LATE_UPLOAD_MS) return releasedAt;
  return firstSeenAt;
}

export function isNews(release: Parameters<typeof newsAt>[0], since: number): boolean {
  const at = newsAt(release);
  return at !== null && at >= since;
}

export function windowStart(now: number): number {
  return now - DIGEST_WINDOW_DAYS * DAY_MS;
}

/** At most this many release details per band read, so a label's back catalogue can't flood the queue. */
export const MAX_DETAILS_PER_READ = 20;

/** The releases of one read whose details (for their URL) are worth a request: news without a URL, newest first. */
export function releasesNeedingDetails(
  releases: readonly FollowRelease[],
  since: number,
): ItemKey[] {
  return releases
    .filter((release) => release.url === null && isNews(release, since))
    .sort((a, b) => (newsAt(b) ?? 0) - (newsAt(a) ?? 0))
    .slice(0, MAX_DETAILS_PER_READ)
    .map((release) => release.itemKey);
}

/**
 * For each band, how many of these crate mates own any of its releases. `lists` are crate mates'
 * match ids (keyToNumber); `catalogues` are each band's item keys.
 */
export function crateMateInterest(
  catalogues: ReadonlyMap<number, readonly ItemKey[]>,
  lists: readonly ArrayLike<number>[],
): Map<number, number> {
  const bandsOf = new Map<number, number[]>();
  for (const [bandId, keys] of catalogues) {
    for (const key of keys) {
      const id = keyToNumber(key);
      bandsOf.set(id, [...(bandsOf.get(id) ?? []), bandId]);
    }
  }
  const interest = new Map<number, number>();
  for (const list of lists) {
    const owned = new Set<number>();
    for (let i = 0; i < list.length; i++) {
      for (const bandId of bandsOf.get(list[i] as number) ?? []) owned.add(bandId);
    }
    for (const bandId of owned) interest.set(bandId, (interest.get(bandId) ?? 0) + 1);
  }
  return interest;
}

export interface DigestInput {
  releases: readonly FollowRelease[];
  /** Accounts you follow (and haven't unfollowed), by band_id. Releases of others are left out. */
  followed: ReadonlySet<number>;
  muted: ReadonlySet<number>;
  /** What no list may show: owned, wishlisted, hidden, and heard when asked (scoring/exclusions). */
  excluded: Pick<Exclusions, 'ids' | 'allows'>;
  interest: ReadonlyMap<number, number>;
  since: number;
}

export interface DigestEntry {
  itemKey: ItemKey;
  matchKey: ItemKey;
  title: string;
  artist: string;
  artId: number | null;
  url: string;
  newsAt: number;
  releasedAt: number | null;
  firstSeenAt: number;
  preorder: boolean;
  /** Every account listing it had it on its first read: back catalogue that's recent by date. */
  baseline: boolean;
  /** The account selling it. */
  sellerId: number;
  /** Followed accounts listing it: the seller first when you follow it. */
  bandIds: number[];
  /** Crate mates owning music from those accounts, the most for any of them. */
  interest: number;
  /** Every account listing it is muted. */
  muted: boolean;
}

/**
 * Newest first by day, so Friday's releases stay together; within a day, the account more of
 * your crate mates buy from goes first.
 */
export function compareEntries(a: DigestEntry, b: DigestEntry): number {
  const day = (entry: DigestEntry) => Math.floor(entry.newsAt / DAY_MS);
  return (
    day(b) - day(a) ||
    b.interest - a.interest ||
    b.newsAt - a.newsAt ||
    a.title.localeCompare(b.title)
  );
}

/**
 * The digest: releases of followed accounts that became news since `since`, one entry per
 * release, without what you own, wishlisted or hid. Releases whose URL isn't known yet wait.
 */
export function buildDigest(input: DigestInput): DigestEntry[] {
  const { followed, muted, excluded, interest, since } = input;
  const entries = new Map<ItemKey, DigestEntry>();
  for (const release of input.releases) {
    const at = newsAt(release);
    if (!followed.has(release.bandId) || release.url === null || at === null || at < since) {
      continue;
    }
    const key = matchKey(release);
    if (excluded.ids.has(keyToNumber(key)) || !excluded.allows(sellerOf(release))) continue;
    const entry = entries.get(release.itemKey) ?? {
      itemKey: release.itemKey,
      matchKey: key,
      title: release.title,
      artist: release.artist,
      artId: release.artId,
      url: release.url,
      newsAt: at,
      releasedAt: release.releasedAt,
      firstSeenAt: release.firstSeenAt,
      preorder: release.preorder,
      baseline: true,
      sellerId: release.sellerId,
      bandIds: [],
      interest: 0,
      muted: true,
    };
    const sellerFirst = release.bandId === release.sellerId;
    entry.bandIds = sellerFirst
      ? [release.bandId, ...entry.bandIds]
      : [...entry.bandIds, release.bandId];
    entry.interest = Math.max(entry.interest, interest.get(release.bandId) ?? 0);
    entry.muted &&= muted.has(release.bandId);
    entry.baseline &&= release.baseline;
    entry.firstSeenAt = Math.min(entry.firstSeenAt, release.firstSeenAt);
    entries.set(release.itemKey, entry);
  }
  return [...entries.values()].sort(compareEntries);
}

/**
 * Found since your last visit to the tab. Back catalogue of an account you just followed only
 * counts when it also came out since then. Nothing is new on a first visit.
 */
export function isNewSince(
  entry: Pick<DigestEntry, 'firstSeenAt' | 'newsAt' | 'baseline'>,
  lastVisitAt: number | null,
): boolean {
  if (lastVisitAt === null || entry.firstSeenAt <= lastVisitAt) return false;
  return !entry.baseline || entry.newsAt > lastVisitAt;
}

/**
 * What a notification announces: releases found since `since` that aren't back catalogue or
 * muted, at most `limit` of them, in digest order, with how many there are in all.
 */
export function notificationPicks(
  entries: readonly DigestEntry[],
  since: number,
  limit: number,
): { picks: DigestEntry[]; total: number } {
  const found = entries.filter(
    (entry) => !entry.baseline && !entry.muted && entry.firstSeenAt > since,
  );
  return { picks: found.slice(0, limit), total: found.length };
}

/**
 * The release's seller and label as hides see them: a followed account listing another account's
 * release is the label it's released on (decisions §3.3, §22).
 */
export function sellerOf(release: Pick<FollowRelease, 'bandId' | 'sellerId'>): Seller {
  return {
    bandId: release.sellerId,
    labelId: release.sellerId === release.bandId ? null : release.bandId,
  };
}
