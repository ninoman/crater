// Converts parsed Bandcamp data into DB records. Pure, so repositories stay thin.

import { matchKey, type CollectionItem, type ReleasePageItem } from '../bandcamp';
import type { ItemRecord, OwnershipRecord } from './schema';

export function itemFromCollection(item: CollectionItem, now: number): ItemRecord {
  return {
    itemKey: item.itemKey,
    albumKey: item.albumKey,
    title: item.title,
    artist: item.artist,
    bandId: item.bandId,
    url: item.url,
    artId: item.artId,
    tags: [],
    supporterCount: item.otherOwners === null ? null : item.otherOwners + 1,
    fetchedAt: now,
  };
}

export function itemFromReleasePage(
  item: ReleasePageItem,
  now: number,
): Omit<ItemRecord, 'supporterCount'> {
  return { ...item, fetchedAt: now };
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
