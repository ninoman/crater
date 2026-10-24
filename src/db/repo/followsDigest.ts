// Reads what New from your follows needs, as plain data (decisions §23). The assembly is in
// src/scoring/followsDigest.ts.

import type { ItemKey } from '../../bandcamp';
import type { BandReleaseRecord, DigheadDb, FollowingRecord, OwnershipRecord } from '../schema';
import { bandCatalogues, mutedBandIds, recentBandReleases } from './bandReleases';
import { fanRows } from './fanRows';
import { heardKeys } from './heard';
import { type HiddenSets, hiddenSets } from './hidden';
import { countJobs } from './queue';

export interface FollowsDigestData {
  releases: BandReleaseRecord[];
  /** Band accounts you follow, not counting ones unfollowed on the tab. */
  accounts: FollowingRecord[];
  muted: Set<number>;
  /** Every release we know of each account that has a release in `releases`. */
  catalogues: Map<number, ItemKey[]>;
  /** Your top crate mates' match ids. */
  crateMateLists: Float64Array[];
  mine: OwnershipRecord[];
  hidden: HiddenSets;
  heard: Set<ItemKey>;
  readAccounts: number;
  checking: number;
}

export async function gatherFollowsDigest(
  db: DigheadDb,
  since: number,
  meFanId: number,
  crateMateIds: readonly number[],
): Promise<FollowsDigestData> {
  const tables = [
    db.bandReleases,
    db.bandReads,
    db.followMutes,
    db.following,
    db.fanMatches,
    db.ownership,
    db.hides,
    db.heard,
    db.queue,
  ];
  return db.transaction('r', tables, async () => {
    const [releases, accounts, muted, lists, mine, hidden, heard, reads, jobs] = await Promise.all([
      recentBandReleases(db, since),
      db.following
        .where('kind')
        .equals('band')
        .filter((row) => !row.unfollowed)
        .toArray(),
      mutedBandIds(db),
      db.fanMatches.bulkGet([...crateMateIds]),
      fanRows(db, meFanId),
      hiddenSets(db),
      heardKeys(db),
      db.bandReads.toCollection().primaryKeys(),
      countJobs(db),
    ]);
    const followed = new Set(accounts.map((row) => row.id));
    const catalogues = await bandCatalogues(db, [
      ...new Set(releases.map((row) => row.bandId).filter((bandId) => followed.has(bandId))),
    ]);
    return {
      releases,
      accounts,
      muted,
      catalogues,
      crateMateLists: lists.flatMap((record) => (record ? [record.matchIds] : [])),
      mine,
      hidden,
      heard,
      readAccounts: reads.filter((bandId) => followed.has(bandId)).length,
      checking: jobs.followReleases,
    };
  });
}
