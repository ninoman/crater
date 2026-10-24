// Reads what the Also-bought scorer needs, as plain data. The ranking itself is in src/scoring.

import type { ItemKey } from '../../bandcamp';
import type {
  DigheadDb,
  FanRecord,
  ItemFields,
  ItemRecord,
  OwnershipRecord,
  StoredItem,
} from '../schema';
import { readItemFields, readOwnership } from '../storage';
import { fanRows } from './fanRows';
import { collectionRead } from './fans';
import { getItemFields, itemFieldsWhere, readItems } from './items';
import { heardKeys } from './heard';
import { type HiddenSets, hiddenSets } from './hidden';

export interface AlsoBoughtData {
  /** albumKey ?? itemKey of the release (decisions §3.8). */
  matchKey: ItemKey;
  /** The release's own record and, for a track, its album's. Either may not be saved yet. */
  release: ItemFields | undefined;
  album: ItemFields | undefined;
  /** Fans other than you known to own the release, scanned or not. */
  knownOwners: number;
  /** Each owner whose collection has been read (the "supporters" N): match ids and size. */
  supporters: { matchIds: Float64Array; size: number }[];
  /** Fans on the release's supporter list, or null before it's fetched. */
  listed: number | null;
  /** Whether every listed supporter's scan has ended, whatever the outcome. */
  allScanned: boolean;
  /** Those owners who are also your crate mates, with their crate mate score. */
  crateMateSupporters: { score: number; matchIds: Float64Array }[];
  /** Your best crate mate's score, which crate mate scores are scaled by. 0 with no crate mates. */
  bestCrateMateScore: number;
  /** Fans other than you with any known collection: the base rate's population. */
  population: number;
  /** Your own ownership rows, collection and wishlist. Empty when nobody is logged in. */
  mine: OwnershipRecord[];
  hidden: HiddenSets;
  /** matchKeys you've heard: for the rows' badge, and for "Hide heard". */
  heard: Set<ItemKey>;
}

export async function gatherAlsoBought(
  db: DigheadDb,
  releaseKey: ItemKey,
  meFanId: number | null,
): Promise<AlsoBoughtData> {
  return db.transaction(
    'r',
    [
      db.items,
      db.ownership,
      db.fans,
      db.fanMatches,
      db.hides,
      db.heard,
      db.crateMates,
      db.releaseSupporters,
    ],
    async () => {
      const [release] = await getItemFields(db, [releaseKey]);
      const matchKey = release?.albumKey ?? releaseKey;
      const album = matchKey === releaseKey ? undefined : (await getItemFields(db, [matchKey]))[0];

      // The matchKey index finds track buyers and album buyers alike.
      const ownerRows = (await db.ownership.where('matchKey').equals(matchKey).toArray()).map(
        readOwnership,
      );
      const ownerIds = [
        ...new Set(ownerRows.filter((row) => row.source === 'collection').map((row) => row.fanId)),
      ].filter((fanId) => fanId !== meFanId);
      const fans = await db.fans.bulkGet(ownerIds);
      const readFans = fans.filter(
        (fan): fan is FanRecord => fan !== undefined && collectionRead(fan.status),
      );
      const readIds = readFans.map((fan) => fan.fanId);

      const [lists, crateMates, best, population, myList, mine, hidden, heard, list] =
        await Promise.all([
          db.fanMatches.bulkGet(readIds),
          db.crateMates.bulkGet(readIds),
          db.crateMates.orderBy('score').last(),
          db.fanMatches.count(),
          meFanId === null ? undefined : db.fanMatches.get(meFanId),
          meFanId === null ? [] : fanRows(db, meFanId),
          hiddenSets(db),
          heardKeys(db),
          db.releaseSupporters.get(releaseKey),
        ]);
      const listedFans = list ? await db.fans.bulkGet(list.fanIds) : [];

      const crateMateSupporters = lists.flatMap((record, i) => {
        const crateMate = crateMates[i];
        return record && crateMate ? [{ score: crateMate.score, matchIds: record.matchIds }] : [];
      });

      return {
        matchKey,
        release,
        album,
        knownOwners: ownerIds.length,
        supporters: lists.flatMap((record, i) => {
          const fan = readFans[i];
          if (!record || !fan) return [];
          // Only a full read knows the size; a partial one is at least what we've seen.
          const size = Math.max(record.matchIds.length, fan.collectionSize ?? fan.scannedItems);
          return [{ matchIds: record.matchIds, size }];
        }),
        listed: list ? list.fanIds.length : null,
        allScanned:
          list !== undefined &&
          listedFans.every((fan) => fan !== undefined && fan.status !== 'queued'),
        crateMateSupporters,
        bestCrateMateScore: best?.score ?? 0,
        population: population - (myList ? 1 : 0),
        mine,
        hidden,
        heard,
      };
    },
  );
}

/** Other releases sold from the same Bandcamp account or on the same label. */
export async function getSellerItems(
  db: DigheadDb,
  bandId: number,
  labelId: number | null,
): Promise<ItemFields[]> {
  const [byBand, byLabel] = await Promise.all([
    itemFieldsWhere(db, 'bandId', [bandId]),
    labelId === null ? [] : itemFieldsWhere(db, 'labelId', [labelId]),
  ]);
  const seen = new Set(byBand.map((item) => item.itemKey));
  return [...byBand, ...byLabel.filter((item) => !seen.has(item.itemKey))];
}

/**
 * The stored row to show for each matchKey: the release itself, or one of its tracks when only
 * tracks of an album have turned up so far. Call inside a transaction with `items`.
 */
export async function shownRows(
  db: DigheadDb,
  matchKeys: readonly ItemKey[],
): Promise<Map<ItemKey, StoredItem>> {
  const direct = await db.items.bulkGet([...matchKeys]);
  const missing = matchKeys.filter((_, i) => direct[i] === undefined);
  const tracks = await Promise.all(
    missing.map((key) => db.items.where('albumKey').equals(key).first()),
  );
  const shown = new Map<ItemKey, StoredItem>();
  matchKeys.forEach((key, i) => {
    const item = direct[i];
    if (item) shown.set(key, item);
  });
  missing.forEach((key, i) => {
    const track = tracks[i];
    if (track) shown.set(key, track);
  });
  return shown;
}

/**
 * The fields of the record getDisplayItems would show, without its URL: what scoring reads, a
 * chunk of candidates at a time, without a band lookup per chunk.
 */
export async function getShownFields(
  db: DigheadDb,
  matchKeys: readonly ItemKey[],
): Promise<Map<ItemKey, ItemFields>> {
  return db.transaction('r', db.items, async () => {
    const shown = await shownRows(db, matchKeys);
    return new Map([...shown].map(([key, row]) => [key, readItemFields(row)]));
  });
}

/** The record to show for each matchKey (see shownRows), with its URL. */
export async function getDisplayItems(
  db: DigheadDb,
  matchKeys: readonly ItemKey[],
): Promise<Map<ItemKey, ItemRecord>> {
  return db.transaction('r', [db.items, db.bands], async () => {
    const shown = await shownRows(db, matchKeys);
    const records = await readItems(db, [...shown.values()]);
    return new Map([...shown.keys()].map((key, i) => [key, records[i] as ItemRecord]));
  });
}
