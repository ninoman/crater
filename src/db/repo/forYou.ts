// Reads what the For-you scorer needs, as plain data. The ranking itself is in src/scoring.

import type { ItemKey } from '../../bandcamp';
import type { DigheadDb, OwnershipRecord } from '../schema';
import { fanRows } from './fanRows';
import { hiddenMatchKeys } from './hidden';

export interface ForYouData {
  /** Each crate mate's distinct collection match ids, in the order asked for. Crate mates with none are left out. */
  crateMateLists: { fanId: number; matchIds: Float64Array; matchTimes: Float64Array }[];
  /** Your own ownership rows, collection and wishlist. */
  mine: OwnershipRecord[];
  hidden: Set<ItemKey>;
}

export async function gatherForYou(
  db: DigheadDb,
  crateMateFanIds: readonly number[],
  meFanId: number,
): Promise<ForYouData> {
  return db.transaction('r', [db.fanMatches, db.ownership, db.hidden], async () => {
    const [lists, mine, hidden] = await Promise.all([
      db.fanMatches.bulkGet([...crateMateFanIds]),
      fanRows(db, meFanId),
      hiddenMatchKeys(db),
    ]);
    const crateMateLists = lists.flatMap((record) =>
      record
        ? [{ fanId: record.fanId, matchIds: record.matchIds, matchTimes: record.matchTimes }]
        : [],
    );
    return { crateMateLists, mine, hidden };
  });
}
