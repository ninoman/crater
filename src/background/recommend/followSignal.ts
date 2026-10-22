// Which releases come from accounts you follow (decisions §16), or none when the boost is off.

import { gatherFollowedBandReleases, type DigheadDb } from '../../db';
import { followedReleases } from '../../scoring/following';

/** Per release match id, the name of the followed account behind it. */
export async function loadFollowedReleases(
  db: DigheadDb,
  enabled: boolean,
): Promise<Map<number, string>> {
  if (!enabled) return new Map();
  const { bands, releases } = await gatherFollowedBandReleases(db);
  return followedReleases(releases, bands);
}
