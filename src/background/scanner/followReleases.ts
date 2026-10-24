// Queues the weekly reads of the accounts you follow (decisions §22).

import {
  bandReadTimes,
  enqueueAt,
  followedBandIds,
  forgetBandReleases,
  queuedTargets,
  raiseJobs,
  readBandsNotFollowed,
  type DigheadDb,
} from '../../db';

const DAY_MS = 24 * 60 * 60 * 1000;
/** Each followed account is read about this often. The daily maintenance pass checks what's due. */
export const FOLLOW_READ_DAYS = 7;

/**
 * The bands due a read, in the order to read them: never read first (in the order given), then
 * the longest since their last read. Bands already queued are left out.
 */
export function bandsDueForRead(
  followed: readonly number[],
  readAt: ReadonlyMap<number, number>,
  queued: ReadonlySet<number>,
  now: number,
): number[] {
  const due = followed.filter((bandId) => {
    const at = readAt.get(bandId);
    return !queued.has(bandId) && (at === undefined || now - at >= FOLLOW_READ_DAYS * DAY_MS);
  });
  const order = (bandId: number) => readAt.get(bandId) ?? Number.NEGATIVE_INFINITY;
  return due
    .map((bandId, index) => ({ bandId, index }))
    .sort((a, b) => order(a.bandId) - order(b.bandId) || a.index - b.index)
    .map(({ bandId }) => bandId);
}

/**
 * Forgets what was read for accounts you no longer follow, queues the reads that are due at
 * `priority`, and raises reads already waiting to it. Returns how many were queued.
 */
export async function queueFollowReads(
  db: DigheadDb,
  priority: number,
  now: number,
): Promise<number> {
  await forgetBandReleases(db, await readBandsNotFollowed(db));
  const [followed, readAt, queued] = await Promise.all([
    followedBandIds(db),
    bandReadTimes(db),
    queuedTargets(db, 'followReleases'),
  ]);
  const due = bandsDueForRead(followed, readAt, new Set([...queued].map(Number)), now);
  await raiseJobs(db, 'followReleases', priority);
  await enqueueAt(
    db,
    due.map((bandId, rank) => ({
      spec: { kind: 'followReleases', target: `${bandId}` },
      at: now,
      rank,
    })),
    priority,
  );
  return due.length;
}
