// Reads what the Also-bought scorer needs, as plain data. The ranking itself is in src/scoring.

import type { ItemKey } from '../../bandcamp';
import type { DigheadDb, FanRecord, ItemRecord, OwnershipRecord } from '../schema';
import { collectionRead } from './fans';
import { hiddenMatchKeys } from './hidden';

export interface AlsoBoughtData {
  /** albumKey ?? itemKey of the release (decisions §3.8). */
  matchKey: ItemKey;
  /** The release's own record and, for a track, its album's. Either may not be saved yet. */
  release: ItemRecord | undefined;
  album: ItemRecord | undefined;
  /** Fans other than you known to own the release, scanned or not. */
  knownOwners: number;
  /** Each owner whose collection has been read (the "supporters" N): match ids and size. */
  supporters: { matchIds: Float64Array; size: number }[];
  /** Fans on the release's supporter list, or null before it's fetched. */
  listed: number | null;
  /** Whether every listed supporter's scan has ended, whatever the outcome. */
  allScanned: boolean;
  /** Those owners who are also your taste twins, with their twin score. */
  twinSupporters: { score: number; matchIds: Float64Array }[];
  /** Your best twin's score, which twin scores are scaled by. 0 with no twins. */
  bestTwinScore: number;
  /** Fans other than you with any known collection: the base rate's population. */
  population: number;
  /** Your own ownership rows, collection and wishlist. Empty when nobody is logged in. */
  mine: OwnershipRecord[];
  hidden: Set<ItemKey>;
}

export async function gatherAlsoBought(
  db: DigheadDb,
  releaseKey: ItemKey,
  meFanId: number | null,
): Promise<AlsoBoughtData> {
  return db.transaction(
    'r',
    [db.items, db.ownership, db.fans, db.fanMatches, db.hidden, db.twins, db.releaseSupporters],
    async () => {
      const release = await db.items.get(releaseKey);
      const matchKey = release?.albumKey ?? releaseKey;
      const album = matchKey === releaseKey ? undefined : await db.items.get(matchKey);

      // The matchKey index finds track buyers and album buyers alike.
      const ownerRows = await db.ownership.where('matchKey').equals(matchKey).toArray();
      const ownerIds = [
        ...new Set(ownerRows.filter((row) => row.source === 'collection').map((row) => row.fanId)),
      ].filter((fanId) => fanId !== meFanId);
      const fans = await db.fans.bulkGet(ownerIds);
      const readFans = fans.filter(
        (fan): fan is FanRecord => fan !== undefined && collectionRead(fan.status),
      );
      const readIds = readFans.map((fan) => fan.fanId);

      const [lists, twins, best, population, myList, mine, hidden, list] = await Promise.all([
        db.fanMatches.bulkGet(readIds),
        db.twins.bulkGet(readIds),
        db.twins.orderBy('score').last(),
        db.fanMatches.count(),
        meFanId === null ? undefined : db.fanMatches.get(meFanId),
        meFanId === null ? [] : db.ownership.where('fanId').equals(meFanId).toArray(),
        hiddenMatchKeys(db),
        db.releaseSupporters.get(releaseKey),
      ]);
      const listedFans = list ? await db.fans.bulkGet(list.fanIds) : [];

      const twinSupporters = lists.flatMap((record, i) => {
        const twin = twins[i];
        return record && twin ? [{ score: twin.score, matchIds: record.matchIds }] : [];
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
        twinSupporters,
        bestTwinScore: best?.score ?? 0,
        population: population - (myList ? 1 : 0),
        mine,
        hidden,
      };
    },
  );
}

/** Other releases sold from the same Bandcamp account or on the same label. */
export async function getSellerItems(
  db: DigheadDb,
  bandId: number,
  labelId: number | null,
): Promise<ItemRecord[]> {
  const [byBand, byLabel] = await Promise.all([
    db.items.where('bandId').equals(bandId).toArray(),
    labelId === null ? [] : db.items.where('labelId').equals(labelId).toArray(),
  ]);
  const seen = new Set(byBand.map((item) => item.itemKey));
  return [...byBand, ...byLabel.filter((item) => !seen.has(item.itemKey))];
}

/**
 * The record to show for each matchKey: the release itself, or one of its tracks when only
 * tracks of an album have turned up so far.
 */
export async function getDisplayItems(
  db: DigheadDb,
  matchKeys: readonly ItemKey[],
): Promise<Map<ItemKey, ItemRecord>> {
  const direct = await db.items.bulkGet([...matchKeys]);
  const found = new Map<ItemKey, ItemRecord>();
  const missing: ItemKey[] = [];
  matchKeys.forEach((key, i) => {
    const item = direct[i];
    if (item) found.set(key, item);
    else missing.push(key);
  });
  const tracks = await Promise.all(
    missing.map((key) => db.items.where('albumKey').equals(key).first()),
  );
  missing.forEach((key, i) => {
    const track = tracks[i];
    if (track) found.set(key, track);
  });
  return found;
}
