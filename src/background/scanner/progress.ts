import type { ItemKey } from '../../bandcamp';
import {
  getFans,
  getMe,
  getReleaseBuyers,
  getReleaseSupporters,
  type CraterDb,
  type FanRecord,
} from '../../db';
import type { ScanProgress } from '../../shared/scan';

/** Any final status counts, including private: we've learned all we're going to. */
export function isScanned(fan: FanRecord | undefined): boolean {
  return fan !== undefined && fan.status !== 'queued';
}

/** Listed supporters, plus owners found in other scans (decisions, "Progress"). */
export async function releaseProgress(db: CraterDb, releaseKey: ItemKey): Promise<ScanProgress> {
  const record = await getReleaseSupporters(db, releaseKey);
  if (!record) return { releaseKey, scanned: 0, total: 0, listed: false };
  const me = await getMe(db);
  const buyers = await getReleaseBuyers(db, releaseKey, record.fanIds, me?.fanId ?? null);
  const listed = new Set(record.fanIds);
  const [listedFans, otherFans] = await Promise.all([
    getFans(db, record.fanIds),
    getFans(
      db,
      buyers.filter((fanId) => !listed.has(fanId)),
    ),
  ]);
  const others = otherFans.filter(isScanned).length;
  return {
    releaseKey,
    scanned: listedFans.filter(isScanned).length + others,
    total: record.fanIds.length + others,
    listed: true,
  };
}
