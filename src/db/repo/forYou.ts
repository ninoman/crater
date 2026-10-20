// Reads what the For-you scorer needs, as plain data. The ranking itself is in src/scoring.

import type { ItemKey } from '../../bandcamp';
import type { DigheadDb, OwnershipRecord } from '../schema';
import { hiddenMatchKeys } from './hidden';

export interface ForYouData {
  /** Each twin's distinct collection match ids, in the order asked for. Twins with none are left out. */
  twinLists: { fanId: number; matchIds: Float64Array }[];
  /** Your own ownership rows, collection and wishlist. */
  mine: OwnershipRecord[];
  hidden: Set<ItemKey>;
}

export async function gatherForYou(
  db: DigheadDb,
  twinFanIds: readonly number[],
  meFanId: number,
): Promise<ForYouData> {
  return db.transaction('r', [db.fanMatches, db.ownership, db.hidden], async () => {
    const [lists, mine, hidden] = await Promise.all([
      db.fanMatches.bulkGet([...twinFanIds]),
      db.ownership.where('fanId').equals(meFanId).toArray(),
      hiddenMatchKeys(db),
    ]);
    const twinLists = lists.flatMap((record) =>
      record ? [{ fanId: record.fanId, matchIds: record.matchIds }] : [],
    );
    return { twinLists, mine, hidden };
  });
}
