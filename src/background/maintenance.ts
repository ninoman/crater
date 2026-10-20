// Once-a-day housekeeping: forget fans nobody has shown us in a long time, so the database
// stops growing with fans that no longer matter (decisions §9).

import { db, forgetFansNotSeenSince, getMe } from '../db';
import { refreshTwins } from './recommend';
import { FAN_FORGET_MS } from './scanner/freshness';

export const MAINTENANCE_ALARM = 'maintenance';
const DAY_MINUTES = 24 * 60;

export async function ensureMaintenanceAlarm(): Promise<void> {
  // Re-creating it on every wake-up would keep pushing the first run back.
  if (!(await chrome.alarms.get(MAINTENANCE_ALARM))) {
    await chrome.alarms.create(MAINTENANCE_ALARM, { periodInMinutes: DAY_MINUTES });
  }
}

export async function runMaintenance(): Promise<void> {
  const me = await getMe(db);
  const before = Date.now() - FAN_FORGET_MS;
  const forgotten = await forgetFansNotSeenSince(db, before, me?.fanId ?? null);
  // Forgotten fans may have been twins, and the base rates behind every score moved.
  if (forgotten > 0) refreshTwins();
}
