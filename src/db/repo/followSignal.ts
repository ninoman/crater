// Reads your followings as a recommendation signal (decisions §16), as plain data. Rows
// unfollowed on the tab don't count.

import { keyToNumber, matchKey } from '../../bandcamp';
import type { CraterDb, FollowKind, FollowingRecord } from '../schema';
import { itemFieldsWhere } from './items';

export interface FollowedBandReleases {
  /** Band accounts (artists and labels) you follow, by band_id, with their names. */
  bands: Map<number, string>;
  /** Every local release sold by, or on the label of, one of them, as match ids. */
  releases: { id: number; bandId: number; labelId: number | null }[];
}

function followed(db: CraterDb, kind: FollowKind): Promise<FollowingRecord[]> {
  return db.following
    .where('kind')
    .equals(kind)
    .filter((row) => !row.unfollowed)
    .toArray();
}

/** The bands you follow and the releases we know from them. Index reads only. */
export async function gatherFollowedBandReleases(db: CraterDb): Promise<FollowedBandReleases> {
  return db.transaction('r', [db.following, db.items], async () => {
    const rows = await followed(db, 'band');
    const bands = new Map(rows.map((row) => [row.id, row.name]));
    if (bands.size === 0) return { bands, releases: [] };
    const ids = [...bands.keys()];
    const [bySeller, byLabel] = await Promise.all([
      itemFieldsWhere(db, 'bandId', ids),
      itemFieldsWhere(db, 'labelId', ids),
    ]);
    const releases = [...bySeller, ...byLabel].map((item) => ({
      id: keyToNumber(matchKey(item)),
      bandId: item.bandId,
      labelId: item.labelId,
    }));
    return { bands, releases };
  });
}

/** The fans you follow, by fan_id. */
export async function followedFanIds(db: CraterDb): Promise<Set<number>> {
  return new Set((await followed(db, 'fan')).map((row) => row.id));
}

/** Whether you follow this fan (and haven't unfollowed them on the tab). */
export async function isFollowedFan(db: CraterDb, fanId: number): Promise<boolean> {
  const row = await db.following.get(['fan', fanId]);
  return row !== undefined && !row.unfollowed;
}
