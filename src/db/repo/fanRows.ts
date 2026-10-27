// One fan's `ownership` rows. There's no `fanId` index since v12 (decisions §19): the primary
// key starts with `fanId`, so a range over it finds them.

import Dexie from 'dexie';
import type { CraterDb, OwnershipRecord } from '../schema';
import { readOwnership } from '../storage';

export function byFan(db: CraterDb, fanId: number) {
  return db.ownership
    .where('[fanId+itemKey]')
    .between([fanId, Dexie.minKey], [fanId, Dexie.maxKey]);
}

/** Every row of a fan's, collection and wishlist. */
export async function fanRows(db: CraterDb, fanId: number): Promise<OwnershipRecord[]> {
  return (await byFan(db, fanId).toArray()).map(readOwnership);
}

/** Deletes every row of these fans. */
export async function deleteFanRows(db: CraterDb, fanIds: readonly number[]): Promise<void> {
  for (const fanId of fanIds) await byFan(db, fanId).delete();
}
