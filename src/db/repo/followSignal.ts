// Reads your followings as a recommendation signal (decisions §16), as plain data. Rows
// unfollowed on the tab don't count.

import { keyToNumber, matchKey } from '../../bandcamp';
import type { DigheadDb, FollowKind, FollowingRecord } from '../schema';

export interface FollowedBandReleases {
  /** Band accounts (artists and labels) you follow, by band_id, with their names. */
  bands: Map<number, string>;
  /** Every local release sold by, or on the label of, one of them, as match ids. */
  releases: { id: number; bandId: number; labelId: number | null }[];
}

function followed(db: DigheadDb, kind: FollowKind): Promise<FollowingRecord[]> {
  return db.following
    .where('kind')
    .equals(kind)
    .filter((row) => !row.unfollowed)
    .toArray();
}

/** The bands you follow and the releases we know from them. Index reads only. */
export async function gatherFollowedBandReleases(db: DigheadDb): Promise<FollowedBandReleases> {
  return db.transaction('r', [db.following, db.items], async () => {
    const rows = await followed(db, 'band');
    const bands = new Map(rows.map((row) => [row.id, row.name]));
    if (bands.size === 0) return { bands, releases: [] };
    const ids = [...bands.keys()];
    const [bySeller, byLabel] = await Promise.all([
      db.items.where('bandId').anyOf(ids).toArray(),
      db.items.where('labelId').anyOf(ids).toArray(),
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
export async function followedFanIds(db: DigheadDb): Promise<Set<number>> {
  return new Set((await followed(db, 'fan')).map((row) => row.id));
}

/** Whether you follow this fan (and haven't unfollowed them on the tab). */
export async function isFollowedFan(db: DigheadDb, fanId: number): Promise<boolean> {
  const row = await db.following.get(['fan', fanId]);
  return row !== undefined && !row.unfollowed;
}
