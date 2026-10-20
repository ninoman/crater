import { itemKey, parseBandcampDate } from './keys';
import { collectionListRequest, firstPageToken, type BandcampRequest } from './requests';
import { rawCollectionResponse, type RawCollectionItem } from './schemas';
import type { CollectionItem, CollectionList, CollectionPage } from './types';
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
    label: raw.label || null,
    labelId: raw.label_id ?? null,
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
    // last_token points at the 20th item whatever `count` was, so with bigger batches it would
    // re-fetch most of the page. Continue from the last item's own token instead.
    nextToken: data.items.at(-1)?.token ?? data.last_token,
  };
}

/** Performs a request and returns the parsed JSON body. The service worker supplies this. */
export type FetchJson = (request: BandcampRequest) => Promise<unknown>;

const LIST_SOURCES: Record<CollectionList, string> = {
  collection: 'collection_items',
  wishlist: 'wishlist_items',
};

/** Fetches and parses one page of a fan's collection or wishlist. */
export async function fetchCollectionPage(
  fetchJson: FetchJson,
  list: CollectionList,
  fanId: number,
  olderThanToken: string,
  count: number,
): Promise<CollectionPage> {
  const json = await fetchJson(collectionListRequest(list, fanId, olderThanToken, count));
  return parseCollectionPage(json, LIST_SOURCES[list]);
}

/**
 * Pages through a fan's collection or wishlist, newest first, following `last_token`.
 * Lazy: the next request is only sent when the consumer asks for the next page,
 * so the consumer controls pacing and can stop early.
 */
export async function* collectionPages(
  fetchJson: FetchJson,
  list: CollectionList,
  fanId: number,
  batchSize: number,
  startToken: string = firstPageToken(),
): AsyncGenerator<CollectionPage> {
  let token = startToken;
  for (;;) {
    const page = await fetchCollectionPage(fetchJson, list, fanId, token, batchSize);
    yield page;
    // A repeated token would loop forever, so treat it as the end.
    if (!page.moreAvailable || page.nextToken === null || page.nextToken === token) return;
    token = page.nextToken;
  }
}
