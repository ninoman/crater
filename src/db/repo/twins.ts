// Reads what the twins scorer needs, as plain data, and stores the leaderboard it produces.

import { keyToNumber, type ItemKey } from '../../bandcamp';
import type { DigheadDb, FanMatchesRecord, ItemFields, TwinRecord } from '../schema';
import { collectionFullyRead } from './fans';
import { fanRows } from './fanRows';
import { getItemFields, itemFieldsWhere } from './items';

/** What rarity weighs a release by: Bandcamp's counts (album first) and the owners we've seen. */
export interface SupporterCounts {
  bandcampCounts: (number | null)[];
  knownOwners: number;
}

type MatchLists = Omit<FanMatchesRecord, 'fanId'>;

export interface TwinBasis {
  /** Your collection's sorted lists, and the album of each track in them. */
  mine: MatchLists & { albumOfTrack: Map<number, number> };
  counts: Map<number, SupporterCounts>;
  /** Label of every match id in the catalog of a label you own something from. */
  labelOf: Map<number, number>;
  /** Distinct match ids per label, for those same labels. */
  catalogSize: Map<number, number>;
  /** Your match ids with a record flagged as a compilation (decisions §17). */
  compilations: Set<number>;
}

/** A fan whose collection we've read, as the scorer takes it. */
export interface TwinCandidate extends MatchLists {
  fanId: number;
  /** The full collection size once known, else what we've scanned. */
  size: number;
}

/** label_id when collection pages gave one, else the selling account (decisions §3.3). */
function labelKey(item: ItemFields): number {
  return item.labelId ?? item.bandId;
}

const EMPTY = new Float64Array();
const NO_LISTS: MatchLists = {
  matchIds: EMPTY,
  trackIds: EMPTY,
  partialIds: EMPTY,
  matchTimes: EMPTY,
};

function matchId(item: ItemFields): number {
  return keyToNumber(item.albumKey ?? item.itemKey);
}

/** Your side of the comparison. Empty when you have no synced collection. */
export async function gatherTwinBasis(db: DigheadDb, meFanId: number): Promise<TwinBasis> {
  return db.transaction('r', [db.ownership, db.fanMatches, db.matchOwners, db.items], async () => {
    const [list, rows] = await Promise.all([db.fanMatches.get(meFanId), fanRows(db, meFanId)]);
    const lists = list ?? NO_LISTS;
    const owned = rows.filter((row) => row.source === 'collection');
    const albumOfTrack = new Map<number, number>();
    for (const row of owned) {
      if (row.itemKey !== row.matchKey) {
        albumOfTrack.set(keyToNumber(row.itemKey), keyToNumber(row.matchKey));
      }
    }
    const keys = [...new Set(owned.flatMap((row) => [row.matchKey, row.itemKey]))];
    const [items, owners] = await Promise.all([
      getItemFields(db, keys),
      db.matchOwners.bulkGet([...lists.matchIds]),
    ]);
    const byKey = new Map<ItemKey, ItemFields>();
    for (const item of items) if (item) byKey.set(item.itemKey, item);

    const counts = new Map<number, SupporterCounts>();
    lists.matchIds.forEach((id, i) => {
      counts.set(id, { bandcampCounts: [], knownOwners: owners[i]?.owners ?? 0 });
    });
    const labels = new Set<number>();
    const compilations = new Set<number>();
    // Albums before tracks, so an album's own count comes first.
    const ordered = [...owned].sort(
      (a, b) => Number(a.itemKey !== a.matchKey) - Number(b.itemKey !== b.matchKey),
    );
    for (const row of ordered) {
      const item = byKey.get(row.itemKey);
      if (!item) continue;
      counts.get(keyToNumber(row.matchKey))?.bandcampCounts.push(item.supporterCount);
      labels.add(labelKey(item));
      if (item.compilation) compilations.add(keyToNumber(row.matchKey));
    }

    const { labelOf, catalogSize } = await labelCatalogs(db, labels);
    const mine = {
      matchIds: lists.matchIds,
      trackIds: lists.trackIds,
      partialIds: lists.partialIds,
      matchTimes: lists.matchTimes,
      albumOfTrack,
    };
    return { mine, counts, labelOf, catalogSize, compilations };
  });
}

/** Each label's releases in the local DB, keyed by match id so tracks fold into albums. */
async function labelCatalogs(db: DigheadDb, labels: Set<number>) {
  const labelOf = new Map<number, number>();
  const catalogSize = new Map<number, number>();
  await Promise.all(
    [...labels].map(async (label) => {
      const [byLabel, byBand] = await Promise.all([
        itemFieldsWhere(db, 'labelId', [label]),
        itemFieldsWhere(db, 'bandId', [label]),
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
      if (!fan || fan.fanId === meFanId || !collectionFullyRead(fan.status)) return;
      candidates.push({
        fanId: fan.fanId,
        matchIds: list.matchIds,
        trackIds: list.trackIds,
        partialIds: list.partialIds,
        matchTimes: list.matchTimes,
        size: fan.collectionSize ?? fan.scannedItems,
      });
    });
    const last = lists.at(-1);
    return { candidates, next: lists.length === limit && last ? last.fanId : null };
  });
}

/** Swaps in both leaderboards at once, so they always come from the same pass. */
export async function replaceTwins(
  db: DigheadDb,
  twins: TwinRecord[],
  latelyTwins: TwinRecord[],
): Promise<void> {
  await db.transaction('rw', [db.twins, db.latelyTwins], async () => {
    await Promise.all([db.twins.clear(), db.latelyTwins.clear()]);
    await db.twins.bulkPut(twins);
    await db.latelyTwins.bulkPut(latelyTwins);
  });
}

/** The leaderboard, best first. */
export function getTwins(db: DigheadDb): Promise<TwinRecord[]> {
  return db.twins.orderBy('score').reverse().toArray();
}

/** The lately leaderboard, most in step first. */
export function getLatelyTwins(db: DigheadDb): Promise<TwinRecord[]> {
  return db.latelyTwins.orderBy('lately').reverse().toArray();
}

/** Fans' match lists with purchase times, for showing what they bought last. Missing fans are left out. */
export async function getPurchaseLists(
  db: DigheadDb,
  fanIds: readonly number[],
): Promise<Pick<FanMatchesRecord, 'fanId' | 'matchIds' | 'matchTimes'>[]> {
  const records = await db.fanMatches.bulkGet([...fanIds]);
  return records.flatMap((record) =>
    record
      ? [{ fanId: record.fanId, matchIds: record.matchIds, matchTimes: record.matchTimes }]
      : [],
  );
}
