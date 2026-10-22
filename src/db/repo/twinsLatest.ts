// Reads what the Twins' latest feed needs, as plain data. The assembly is in src/scoring.

import type { ItemKey } from '../../bandcamp';
import type { DigheadDb, FanMatchesRecord, OwnershipRecord } from '../schema';
import { fanRows } from './fanRows';
import { hiddenMatchKeys } from './hidden';
import { queuedFans } from './queue';

export interface TwinsLatestData {
  /** In the order asked for. Twins with no lists are left out. */
  twinLists: Pick<FanMatchesRecord, 'fanId' | 'matchIds' | 'matchTimes'>[];
  /** Your own ownership rows, collection and wishlist. */
  mine: OwnershipRecord[];
  hidden: Set<ItemKey>;
  /** Twins with a scan waiting. */
  queued: Set<number>;
}

export async function gatherTwinsLatest(
  db: DigheadDb,
  twinFanIds: readonly number[],
  meFanId: number,
): Promise<TwinsLatestData> {
  return db.transaction('r', [db.fanMatches, db.ownership, db.hidden, db.queue], async () => {
    const [lists, mine, hidden, queued] = await Promise.all([
      db.fanMatches.bulkGet([...twinFanIds]),
      fanRows(db, meFanId),
      hiddenMatchKeys(db),
      queuedFans(db, twinFanIds),
    ]);
    const twinLists = lists.flatMap((record) =>
      record
        ? [{ fanId: record.fanId, matchIds: record.matchIds, matchTimes: record.matchTimes }]
        : [],
    );
    return { twinLists, mine, hidden, queued };
  });
}
