import type { ItemKey } from '../../bandcamp';
import { getFans, getReleaseSupporters, type CraterDb, type FanRecord } from '../../db';
import type { ScanProgress } from '../../shared/scan';

/** Any final status counts, including private: we've learned all we're going to. */
export function isScanned(fan: FanRecord | undefined): boolean {
  return fan !== undefined && fan.status !== 'queued';
}

export async function releaseProgress(db: CraterDb, releaseKey: ItemKey): Promise<ScanProgress> {
  const record = await getReleaseSupporters(db, releaseKey);
  if (!record) return { releaseKey, scanned: 0, total: 0, listed: false };
  const fans = await getFans(db, record.fanIds);
  return {
    releaseKey,
    scanned: fans.filter(isScanned).length,
    total: record.fanIds.length,
    listed: true,
  };
}
