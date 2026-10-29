// Reads what pass 0 ranks a release's supporters by (decisions §12), as plain data.

import { keyFromNumber, keyToNumber, matchKey, type ItemKey } from '../../bandcamp';
import type { CraterDb } from '../schema';
import { getItemFields, itemFieldsWhere } from './items';

/** What a release's supporters are ranked by before any of them is read. */
export interface PassZeroBasis {
  /** Your collection's match ids. */
  mine: Set<number>;
  /** Other releases from the release's seller or label, as match ids. */
  sellerCatalog: Set<number>;
  /** Bandcamp's supporter count and the owners we've seen, per id in `mine` and the catalog. */
  counts: Map<number, { bandcamp: number | null; known: number }>;
  /** The release's own match id. */
  release: number;
  /** In page order, with what each is known to own so far. */
  supporters: { fanId: number; matchIds: Float64Array }[];
}

const EMPTY = new Float64Array();

/**
 * Your collection, the release's seller and label catalog, their supporter counts and what each
 * supporter is known to own. Null when the release or its supporter list isn't stored.
 */
export async function gatherPassZero(
  db: CraterDb,
  releaseKey: ItemKey,
  meFanId: number | null,
): Promise<PassZeroBasis | null> {
  return db.transaction(
    'r',
    [db.items, db.releaseSupporters, db.fanMatches, db.matchOwners],
    async () => {
      const [[release], list] = await Promise.all([
        getItemFields(db, [releaseKey]),
        db.releaseSupporters.get(releaseKey),
      ]);
      if (!release || !list) return null;
      const releaseId = keyToNumber(matchKey(release));

      const [mineRecord, lists, bySeller, byLabel] = await Promise.all([
        meFanId === null ? undefined : db.fanMatches.get(meFanId),
        db.fanMatches.bulkGet(list.fanIds),
        itemFieldsWhere(db, 'bandId', [release.bandId]),
        release.labelId === null ? [] : itemFieldsWhere(db, 'labelId', [release.labelId]),
      ]);
      const mine = new Set(mineRecord?.matchIds ?? EMPTY);
      const sellerCatalog = new Set(
        [...bySeller, ...byLabel]
          .map((item) => keyToNumber(matchKey(item)))
          .filter((id) => id !== releaseId),
      );

      return {
        mine,
        sellerCatalog,
        counts: await matchCounts(db, [...new Set([...mine, ...sellerCatalog])]),
        release: releaseId,
        supporters: list.fanIds.map((fanId, i) => ({
          fanId,
          matchIds: lists[i]?.matchIds ?? EMPTY,
        })),
      };
    },
  );
}

/** What the seed backlog is ranked by across all your releases (decisions §5). */
export interface SeedFansBasis {
  /** Your collection's match ids. */
  mine: Set<number>;
  /** Bandcamp's supporter count and the owners we've seen, per id in `mine`. */
  counts: Map<number, { bandcamp: number | null; known: number }>;
  /** In the order given, with what each is known to own so far. */
  fans: { fanId: number; matchIds: Float64Array }[];
}

/** Your collection, its supporter counts and what each of these fans is known to own. */
export async function gatherSeedFans(
  db: CraterDb,
  meFanId: number | null,
  fanIds: number[],
): Promise<SeedFansBasis> {
  return db.transaction('r', [db.items, db.fanMatches, db.matchOwners], async () => {
    const [mineRecord, lists] = await Promise.all([
      meFanId === null ? undefined : db.fanMatches.get(meFanId),
      db.fanMatches.bulkGet(fanIds),
    ]);
    const mine = new Set(mineRecord?.matchIds ?? EMPTY);
    return {
      mine,
      counts: await matchCounts(db, [...mine]),
      fans: fanIds.map((fanId, i) => ({ fanId, matchIds: lists[i]?.matchIds ?? EMPTY })),
    };
  });
}

async function matchCounts(
  db: CraterDb,
  ids: number[],
): Promise<Map<number, { bandcamp: number | null; known: number }>> {
  const [items, owners] = await Promise.all([
    getItemFields(db, ids.map(keyFromNumber)),
    db.matchOwners.bulkGet(ids),
  ]);
  return new Map(
    ids.map((id, i) => [
      id,
      { bandcamp: items[i]?.supporterCount ?? null, known: owners[i]?.owners ?? 0 },
    ]),
  );
}
