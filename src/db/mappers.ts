// Converts parsed Bandcamp data into DB records. Pure, so repositories stay thin.

import {
  matchKey,
  type CollectionItem,
  type FollowingRow,
  type ReleaseInfo,
  type ReleasePageItem,
  type Supporter,
} from '../bandcamp';
import type { SyncedFollowing } from './repo/following';
import type { FanRecord, ItemRecord, OwnershipRecord } from './schema';

export function itemFromCollection(item: CollectionItem): ItemRecord {
  return {
    itemKey: item.itemKey,
    albumKey: item.albumKey,
    title: item.title,
    artist: item.artist,
    bandId: item.bandId,
    url: item.url,
    artId: item.artId,
    label: item.label,
    labelId: item.labelId,
    tags: [],
    supporterCount: item.otherOwners === null ? null : item.otherOwners + 1,
    compilation: item.compilation,
  };
}

export function itemFromReleasePage(
  item: ReleasePageItem,
): Omit<ItemRecord, 'supporterCount' | 'label' | 'labelId'> {
  return { ...item };
}

export function ownershipFromCollection(
  fanId: number,
  item: CollectionItem,
  source: OwnershipRecord['source'],
): OwnershipRecord {
  return {
    fanId,
    itemKey: item.itemKey,
    matchKey: matchKey(item),
    source,
    addedAt: item.addedAt,
  };
}

/** A supporter owns the release they're listed under, from the purchase time in their token. */
export function ownershipFromSupporter(
  release: Pick<ReleaseInfo, 'itemKey' | 'albumKey'>,
  supporter: Supporter,
): OwnershipRecord {
  return {
    fanId: supporter.fanId,
    itemKey: release.itemKey,
    matchKey: matchKey(release),
    source: 'collection',
    addedAt: supporter.purchasedAt,
  };
}

export function fanFromSupporter(supporter: Supporter, now: number): FanRecord {
  return {
    fanId: supporter.fanId,
    username: supporter.username,
    name: supporter.name,
    imageId: supporter.imageId,
    collectionSize: null,
    scannedItems: 0,
    collectionFetchedAt: null,
    status: 'queued',
    lastSeenAt: now,
  };
}

export function followingFromRow(row: FollowingRow): SyncedFollowing {
  return { ...row, followedAt: row.followedAt ?? 0 };
}
