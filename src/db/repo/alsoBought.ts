// Reads what the Also-bought scorer needs, as plain data. The ranking itself is in src/scoring.

import type { ItemKey } from '../../bandcamp';
import type { DigheadDb, ItemRecord, OwnershipRecord } from '../schema';
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
  /** The match ids of each owner whose collection has been read: the "supporters" N. */
  ownerLists: Float64Array[];
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
    [db.items, db.ownership, db.fans, db.fanMatches, db.hidden],
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
      const readIds = ownerIds.filter((_, i) => collectionRead(fans[i]?.status));

      const [lists, listed, myList, mine, hidden] = await Promise.all([
        db.fanMatches.bulkGet(readIds),
        db.fanMatches.count(),
        meFanId === null ? undefined : db.fanMatches.get(meFanId),
        meFanId === null ? [] : db.ownership.where('fanId').equals(meFanId).toArray(),
        hiddenMatchKeys(db),
      ]);

      return {
        matchKey,
        release,
        album,
        knownOwners: ownerIds.length,
        ownerLists: lists.flatMap((record) => (record ? [record.matchIds] : [])),
        population: listed - (myList ? 1 : 0),
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
