// Reads what the twins scorer needs, as plain data, and stores the leaderboard it produces.

import { keyToNumber, type ItemKey } from '../../bandcamp';
import type { DigheadDb, ItemRecord, TwinRecord } from '../schema';
import { collectionRead } from './fans';

/** What rarity weighs a release by: Bandcamp's counts (album first) and the owners we've seen. */
export interface SupporterCounts {
  bandcampCounts: (number | null)[];
  knownOwners: number;
}

export interface TwinBasis {
  /** Your collection as sorted match ids. */
  mine: Float64Array;
  counts: Map<number, SupporterCounts>;
  /** Label of every match id in the catalog of a label you own something from. */
  labelOf: Map<number, number>;
  /** Distinct match ids per label, for those same labels. */
  catalogSize: Map<number, number>;
}

/** A fan whose collection we've read, as the scorer takes it. */
export interface TwinCandidate {
  fanId: number;
  matchIds: Float64Array;
  /** The full collection size once known, else what we've scanned. */
  size: number;
}

/** label_id when collection pages gave one, else the selling account (decisions §3.3). */
function labelKey(item: ItemRecord): number {
  return item.labelId ?? item.bandId;
}

function matchId(item: ItemRecord): number {
  return keyToNumber(item.albumKey ?? item.itemKey);
}

/** Your side of the comparison. Empty when you have no synced collection. */
export async function gatherTwinBasis(db: DigheadDb, meFanId: number): Promise<TwinBasis> {
  return db.transaction('r', [db.ownership, db.fanMatches, db.matchOwners, db.items], async () => {
    const [list, rows] = await Promise.all([
      db.fanMatches.get(meFanId),
      db.ownership.where('fanId').equals(meFanId).toArray(),
    ]);
    const mine = list?.matchIds ?? new Float64Array();
    const owned = rows.filter((row) => row.source === 'collection');
    const keys = [...new Set(owned.flatMap((row) => [row.matchKey, row.itemKey]))];
    const [items, owners] = await Promise.all([
      db.items.bulkGet(keys),
      db.matchOwners.bulkGet([...mine]),
    ]);
    const byKey = new Map<ItemKey, ItemRecord>();
    for (const item of items) if (item) byKey.set(item.itemKey, item);

    const counts = new Map<number, SupporterCounts>();
    mine.forEach((id, i) => {
      counts.set(id, { bandcampCounts: [], knownOwners: owners[i]?.owners ?? 0 });
    });
    const labels = new Set<number>();
    // Albums before tracks, so an album's own count comes first.
    const ordered = [...owned].sort(
      (a, b) => Number(a.itemKey !== a.matchKey) - Number(b.itemKey !== b.matchKey),
    );
    for (const row of ordered) {
      const item = byKey.get(row.itemKey);
      if (!item) continue;
      counts.get(keyToNumber(row.matchKey))?.bandcampCounts.push(item.supporterCount);
      labels.add(labelKey(item));
    }

    const { labelOf, catalogSize } = await labelCatalogs(db, labels);
    return { mine, counts, labelOf, catalogSize };
  });
}

/** Each label's releases in the local DB, keyed by match id so tracks fold into albums. */
async function labelCatalogs(db: DigheadDb, labels: Set<number>) {
  const labelOf = new Map<number, number>();
  const catalogSize = new Map<number, number>();
  await Promise.all(
    [...labels].map(async (label) => {
      const [byLabel, byBand] = await Promise.all([
        db.items.where('labelId').equals(label).toArray(),
        db.items.where('bandId').equals(label).toArray(),
      ]);
      const catalog = new Set<number>();
      for (const item of [...byLabel, ...byBand]) {
        if (labelKey(item) === label) catalog.add(matchId(item));
      }
      for (const id of catalog) if (!labelOf.has(id)) labelOf.set(id, label);
      catalogSize.set(label, catalog.size);
    }),
  );
  return { labelOf, catalogSize };
}

/**
 * Up to `limit` fans after `afterFanId` in fanId order, keeping those whose collection we've
 * read. `next` is where the following page starts, or null at the end.
 */
export async function readTwinCandidates(
  db: DigheadDb,
  afterFanId: number,
  limit: number,
  meFanId: number,
): Promise<{ candidates: TwinCandidate[]; next: number | null }> {
  return db.transaction('r', [db.fanMatches, db.fans], async () => {
    const lists = await db.fanMatches.where('fanId').above(afterFanId).limit(limit).toArray();
    const fans = await db.fans.bulkGet(lists.map((list) => list.fanId));
    const candidates: TwinCandidate[] = [];
    lists.forEach((list, i) => {
      const fan = fans[i];
      if (!fan || fan.fanId === meFanId || !collectionRead(fan.status)) return;
      candidates.push({
        fanId: fan.fanId,
        matchIds: list.matchIds,
        size: fan.collectionSize ?? fan.scannedItems,
      });
    });
    const last = lists.at(-1);
    return { candidates, next: lists.length === limit && last ? last.fanId : null };
  });
}

export async function replaceTwins(db: DigheadDb, twins: TwinRecord[]): Promise<void> {
  await db.transaction('rw', db.twins, async () => {
    await db.twins.clear();
    await db.twins.bulkPut(twins);
  });
}

/** The leaderboard, best first. */
export function getTwins(db: DigheadDb): Promise<TwinRecord[]> {
  return db.twins.orderBy('score').reverse().toArray();
}
