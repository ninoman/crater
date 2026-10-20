import { toCollectionItems } from './collection';
import { toFollowingRows } from './following';
import { ParserError } from './errors';
import { readBlobById } from './html';
import { rawFanPagedata, rawFollowingPagedata, type RawFollowee } from './schemas';
import type { FanPage, FollowingKind, FollowingList } from './types';
import { validate } from './validate';

/** Orders the cache by `pending_sequence`: its keys are numeric, so JS sorts them, not Bandcamp. */
function followingList(
  kind: FollowingKind,
  data: { item_count: number; last_token: string | null; pending_sequence?: string[] | null },
  cache: Record<string, RawFollowee>,
): FollowingList {
  const ordered = data.pending_sequence
    ? data.pending_sequence.flatMap((key) => (cache[key] ? [cache[key]] : []))
    : Object.values(cache);
  return {
    itemCount: data.item_count,
    lastToken: data.last_token,
    firstRows: toFollowingRows(ordered, kind),
  };
}

/** Parses a fan profile page (bandcamp.com/<username>). */
export function parseFanPage(html: string): FanPage {
  const json = readBlobById(html, 'pagedata');
  if (json === null) throw new ParserError('fan page', 'no #pagedata blob');
  const data = validate(rawFanPagedata, json, '#pagedata');
  const { fan_data: fan, collection_data: collection, wishlist_data: wishlist } = data;

  // item_cache is keyed by sale item; collection_data.sequence holds the display order.
  const cache = data.item_cache.collection;
  const ordered = collection.sequence
    ? collection.sequence.flatMap((key) => (cache[key] ? [cache[key]] : []))
    : Object.values(cache);

  const following = validate(rawFollowingPagedata, json, '#pagedata');
  const viewer = data.identities.fan;
  return {
    fanId: fan.fan_id,
    username: fan.username,
    name: fan.name || fan.username,
    isOwnPage: fan.is_own_page === true,
    collection: {
      itemCount: collection.item_count,
      hiddenCount: collection.hidden_items_count ?? 0,
      lastToken: collection.last_token,
    },
    wishlist: {
      itemCount: wishlist.item_count,
      hidden: wishlist.hidden === true,
      lastToken: wishlist.last_token,
    },
    firstItems: toCollectionItems(ordered),
    following: {
      bands: followingList(
        'band',
        following.following_bands_data,
        following.item_cache.following_bands,
      ),
      fans: followingList(
        'fan',
        following.following_fans_data,
        following.item_cache.following_fans,
      ),
    },
    viewer: viewer ? { fanId: viewer.id, username: viewer.username } : null,
  };
}
