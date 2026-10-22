// Reads what the Crate mates' latest feed needs, as plain data. The assembly is in src/scoring.

import type { ItemKey } from '../../bandcamp';
import type { DigheadDb, FanMatchesRecord, OwnershipRecord } from '../schema';
import { fanRows } from './fanRows';
import { hiddenMatchKeys } from './hidden';
import { queuedFans } from './queue';

export interface CrateMatesLatestData {
  /** In the order asked for. Crate mates with no lists are left out. */
  crateMateLists: Pick<FanMatchesRecord, 'fanId' | 'matchIds' | 'matchTimes'>[];
  /** Your own ownership rows, collection and wishlist. */
  mine: OwnershipRecord[];
  hidden: Set<ItemKey>;
  /** Crate mates with a scan waiting. */
  queued: Set<number>;
}

export async function gatherCrateMatesLatest(
  db: DigheadDb,
  crateMateFanIds: readonly number[],
  meFanId: number,
): Promise<CrateMatesLatestData> {
  return db.transaction('r', [db.fanMatches, db.ownership, db.hidden, db.queue], async () => {
    const [lists, mine, hidden, queued] = await Promise.all([
      db.fanMatches.bulkGet([...crateMateFanIds]),
      fanRows(db, meFanId),
      hiddenMatchKeys(db),
      queuedFans(db, crateMateFanIds),
    ]);
    const crateMateLists = lists.flatMap((record) =>
      record
        ? [{ fanId: record.fanId, matchIds: record.matchIds, matchTimes: record.matchTimes }]
        : [],
    );
    return { crateMateLists, mine, hidden, queued };
  });
}
