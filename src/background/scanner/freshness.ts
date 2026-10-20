import type { FanRecord, ReleaseSupportersRecord } from '../../db';

const DAY_MS = 24 * 60 * 60 * 1000;
export const FAN_FRESH_MS = 30 * DAY_MS;
export const SUPPORTERS_FRESH_MS = 7 * DAY_MS;

/** A fan needs a scan unless their collection was read in the last 30 days. */
export function needsFanScan(
  fan: Pick<FanRecord, 'collectionFetchedAt'> | undefined,
  now: number,
): boolean {
  const at = fan?.collectionFetchedAt ?? null;
  return at === null || now - at >= FAN_FRESH_MS;
}

/** A release's supporter list is reused for 7 days. */
export function supportersAreFresh(
  record: Pick<ReleaseSupportersRecord, 'fetchedAt'> | undefined,
  now: number,
): boolean {
  return record !== undefined && now - record.fetchedAt < SUPPORTERS_FRESH_MS;
}
