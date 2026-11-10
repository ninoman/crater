// Once-a-day housekeeping: forget fans nobody has shown us in a long time, so the database
// stops growing with fans that no longer matter (decisions §9), and queue the top lately crate mates'
// re-reads that are due (§11), and the weekly reads of your follows (§23).

import { crateMateFanIds, db, forgetFansNotSeenSince, getMe, queuedTargets } from '../db';
import { refreshCrateMates } from './recommend';
import { queueFollowReleases, rescanLatelyCrateMates } from './scanner';
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
  const [me, crateMates, waiting] = await Promise.all([
    getMe(db),
    crateMateFanIds(db),
    queuedTargets(db, 'fan'),
  ]);
  // You and your crate mates feed every recommendation, however long ago a page showed them.
  // Fans waiting for a scan hold almost nothing yet, and a long seed backlog outlasts the cutoff.
  const keep = new Set([...crateMates, ...[...waiting].map(Number)]);
  if (me) keep.add(me.fanId);
  const before = Date.now() - FAN_FORGET_MS;
  const forgotten = await forgetFansNotSeenSince(db, before, keep);
  // Forgotten fans may have been crate mates, and the base rates behind every score moved.
  if (forgotten > 0) refreshCrateMates();
  await rescanLatelyCrateMates();
  await queueFollowReleases();
}
