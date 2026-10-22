// What page badges say about linked releases, for a whole page of links in one read (§15).

import { keyToNumber, type ItemKey } from '../../bandcamp';
import type { PageBadge, ReleaseRef } from '../../shared/pageBadges';
import type { DigheadDb, ItemFields, ItemRecord, OwnershipRecord } from '../schema';
import { releaseUrlHost } from '../storage';
import { fanRows } from './fanRows';
import { getItemFields, itemsWhere } from './items';
import { getCrateMates } from './crateMates';

interface Release {
  itemKey: ItemKey;
  albumKey: ItemKey | null;
}

/** Sorted-array membership: fanMatches lists are sorted ascending. */
function contains(sorted: Float64Array, value: number): boolean {
  let lo = 0;
  let hi = sorted.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const at = sorted[mid] as number;
    if (at === value) return true;
    if (at < value) lo = mid + 1;
    else hi = mid - 1;
  }
  return false;
}

/**
 * Items that may sit at these URLs: every release of the bands seen under their hosts. Each
 * stored URL's host is in its band's `hosts` (decisions §19), so none is missed.
 */
async function itemsAtUrls(db: DigheadDb, urls: string[]): Promise<ItemRecord[]> {
  const hosts = [...new Set(urls.flatMap((url) => releaseUrlHost(url) ?? []))];
  if (hosts.length === 0) return [];
  const bandIds = await db.bands.where('hosts').anyOf(hosts).primaryKeys();
  return itemsWhere(db, 'bandId', [...new Set(bandIds)]);
}

/** Each ref's release: its item record when we have one, else its id alone. Null when unknown. */
async function resolve(db: DigheadDb, refs: ReleaseRef[]): Promise<(Release | null)[]> {
  const keys = refs.flatMap((ref) => (ref.itemKey ? [ref.itemKey] : []));
  const urls = refs.flatMap((ref) => (ref.itemKey ? [] : [ref.url]));
  const [byKeyList, byUrlList] = await Promise.all([
    getItemFields(db, keys),
    itemsAtUrls(db, urls),
  ]);
  const byKey = new Map<ItemKey, ItemFields>();
  for (const item of byKeyList) if (item) byKey.set(item.itemKey, item);
  const byUrl = new Map(byUrlList.map((item) => [item.url, item]));
  return refs.map((ref) => {
    if (ref.itemKey) return byKey.get(ref.itemKey) ?? { itemKey: ref.itemKey, albumKey: null };
    return byUrl.get(ref.url) ?? null;
  });
}

/** You own a release if you own it, its album, or (for an album) any track of it (§3.8). */
function ownsRelease(rows: OwnershipRecord[], release: Release): boolean {
  return rows.some(
    (row) =>
      row.itemKey === release.itemKey ||
      row.itemKey === release.albumKey ||
      row.matchKey === release.itemKey,
  );
}

/**
 * One badge per ref, in order; null for a release we know nothing about. Your ownership comes
 * from your own rows; crate mates are the top `topCrateMatesK` of the leaderboard, counted by matchKey.
 */
export async function pageBadges(
  db: DigheadDb,
  refs: ReleaseRef[],
  topCrateMatesK: number,
): Promise<(PageBadge | null)[]> {
  if (refs.length === 0) return [];
  return db.transaction(
    'r',
    [db.items, db.bands, db.me, db.ownership, db.crateMates, db.fanMatches],
    async () => {
      const [releases, me, board] = await Promise.all([
        resolve(db, refs),
        db.me.get('self'),
        getCrateMates(db),
      ]);
      const mine = me ? await fanRows(db, me.fanId) : [];
      const collection = mine.filter((row) => row.source === 'collection');
      const wishlist = mine.filter((row) => row.source === 'wishlist');
      const top = board.slice(0, topCrateMatesK);
      const lists = (await db.fanMatches.bulkGet(top.map((crateMate) => crateMate.fanId))).flatMap(
        (list) => (list ? [list.matchIds] : []),
      );

      return releases.map((release) => {
        if (!release) return null;
        const owned = ownsRelease(collection, release);
        const wishlisted =
          !owned &&
          wishlist.some(
            (row) => row.itemKey === release.itemKey || row.itemKey === release.albumKey,
          );
        const id = keyToNumber(release.albumKey ?? release.itemKey);
        const crateMates = lists.filter((matchIds) => contains(matchIds, id)).length;
        return { owned, wishlisted, crateMates, topCrateMates: top.length };
      });
    },
  );
}
