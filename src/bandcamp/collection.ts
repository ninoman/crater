import { itemKey, parseBandcampDate } from './keys';
import { rawCollectionResponse, type RawCollectionItem } from './schemas';
import type { CollectionItem, CollectionPage } from './types';
import { assertNotApiError, validate } from './validate';

const PURCHASE_KINDS = ['album', 'track', 'package'] as const;

function isPurchaseKind(value: string): value is CollectionItem['purchaseKind'] {
  return (PURCHASE_KINDS as readonly string[]).includes(value);
}

/** Maps one raw item. Returns null for item kinds we don't track (e.g. subscriptions). */
export function toCollectionItem(raw: RawCollectionItem): CollectionItem | null {
  if (!isPurchaseKind(raw.item_type)) return null;
  const isAlbumTrack = raw.tralbum_type === 't' && raw.album_id != null;
  return {
    itemKey: itemKey(raw.tralbum_type, raw.tralbum_id),
    albumKey: isAlbumTrack ? itemKey('a', raw.album_id as number) : null,
    title: raw.item_title,
    artist: raw.band_name,
    bandId: raw.band_id,
    url: raw.item_url,
    artId: raw.item_art_id ?? null,
    purchaseKind: raw.item_type,
    otherOwners: raw.also_collected_count ?? null,
    addedAt: parseBandcampDate(raw.purchased ?? raw.added),
  };
}

export function toCollectionItems(raws: RawCollectionItem[]): CollectionItem[] {
  return raws.map(toCollectionItem).filter((item): item is CollectionItem => item !== null);
}

/** Parses a collection_items or wishlist_items response. */
export function parseCollectionPage(json: unknown, source = 'collection_items'): CollectionPage {
  const data = assertNotApiError(validate(rawCollectionResponse, json, source), source);
  return {
    items: toCollectionItems(data.items),
    moreAvailable: data.more_available,
    lastToken: data.last_token,
  };
}
