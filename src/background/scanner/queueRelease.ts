import type { ItemKey } from '../../bandcamp';
import { enqueueAt, getQueuedJob, supportersFetchedAt, type CraterDb } from '../../db';
import type { QueueReleaseStatus } from '../../shared/scan';
import { supportersAreFresh } from './freshness';
import { BACKGROUND } from './priority';

/**
 * Queues a release's supporters on request, at BACKGROUND priority so it never jumps ahead of
 * the page you're reading. Fresh supporter lists aren't re-read; a queued job isn't duplicated,
 * though it still moves up if it was waiting at a lower priority.
 */
export async function queueRelease(
  db: CraterDb,
  itemKey: ItemKey,
  url: string,
  now: number,
): Promise<QueueReleaseStatus> {
  const listedAt = (await supportersFetchedAt(db, [itemKey])).get(itemKey);
  if (listedAt !== undefined && supportersAreFresh({ fetchedAt: listedAt }, now)) return 'fresh';
  const queued = (await getQueuedJob(db, 'release', itemKey)) !== undefined;
  await enqueueAt(db, [{ spec: { kind: 'release', target: itemKey, url }, at: now }], BACKGROUND);
  return queued ? 'already-queued' : 'queued';
}
