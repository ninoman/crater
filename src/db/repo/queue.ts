import type { ItemKey } from '../../bandcamp';
import type { DigheadDb, FanJob, QueueJob, ReleaseJob } from '../schema';

/** What to scan. A job is unique per kind and target. */
export type JobSpec =
  | Pick<ReleaseJob, 'kind' | 'target' | 'url'>
  | Pick<FanJob, 'kind' | 'target' | 'via'>;

/** A fan's scan, queued from `via`'s supporter list (null when no release queued it). */
export function fanJob(fanId: number, via: ItemKey | null = null): JobSpec {
  return { kind: 'fan', target: `${fanId}`, via };
}

/** Where a job waits in line within its priority, and its tie-break there. */
export interface JobPlace {
  spec: JobSpec;
  at: number;
  rank?: number;
}

function newJob({ spec, at, rank = 0 }: JobPlace, priority: number): QueueJob {
  return { ...spec, priority, rank, attempts: 0, nextAttemptAt: at, cursor: null } as QueueJob;
}

/** Adds jobs that are due from `now`, skipping ones already queued (see enqueueAt). */
export function enqueue(
  db: DigheadDb,
  specs: JobSpec[],
  priority: number,
  now: number,
): Promise<void> {
  return enqueueAt(
    db,
    specs.map((spec) => ({ spec, at: now })),
    priority,
  );
}

/**
 * Adds jobs, each due from its own `at`, which is also its place in line within the priority.
 * A duplicate only raises the existing job's priority, so its cursor and retry state survive.
 */
export async function enqueueAt(
  db: DigheadDb,
  entries: JobPlace[],
  priority: number,
): Promise<void> {
  if (entries.length === 0) return;
  await db.transaction('rw', db.queue, async () => {
    const existing = await db.queue
      .where('[kind+target]')
      .anyOf(entries.map(({ spec }) => [spec.kind, spec.target]))
      .toArray();
    const byKey = new Map(existing.map((job) => [`${job.kind}:${job.target}`, job]));
    const fresh: QueueJob[] = [];
    for (const entry of entries) {
      const { spec } = entry;
      const key = `${spec.kind}:${spec.target}`;
      const job = byKey.get(key);
      if (!job) {
        const added = newJob(entry, priority);
        fresh.push(added);
        byKey.set(key, added);
      } else if (job.id !== undefined && priority < job.priority) {
        await db.queue.update(job.id, { priority });
      }
    }
    await db.queue.bulkAdd(fresh);
  });
}

export function getQueuedJob(
  db: DigheadDb,
  kind: QueueJob['kind'],
  target: string,
): Promise<QueueJob | undefined> {
  return db.queue.where('[kind+target]').equals([kind, target]).first();
}

/**
 * The most urgent job that is due: lowest priority first, then earliest nextAttemptAt, then
 * lowest rank, then insertion order.
 */
export function nextJob(db: DigheadDb, now: number): Promise<QueueJob | undefined> {
  return db.queue
    .orderBy('[priority+nextAttemptAt+rank]')
    .filter((job) => job.nextAttemptAt <= now)
    .first();
}

export async function completeJob(db: DigheadDb, job: QueueJob): Promise<void> {
  if (job.id !== undefined) await db.queue.delete(job.id);
}

/** Counts a failed run. With `retryAt` the job waits until then, without it the job is dropped. */
export async function failJob(db: DigheadDb, job: QueueJob, retryAt: number | null) {
  if (job.id === undefined) return;
  if (retryAt === null) await db.queue.delete(job.id);
  else await db.queue.update(job.id, { attempts: job.attempts + 1, nextAttemptAt: retryAt });
}

/** Where a multi-request job carries on, and optionally a new place in the queue. */
export interface JobProgress {
  cursor: NonNullable<QueueJob['cursor']>;
  rank?: number;
  priority?: number;
}

/** Saves how far a multi-request job got, so a killed worker resumes instead of restarting. */
export async function saveProgress(db: DigheadDb, job: QueueJob, progress: JobProgress) {
  if (job.id !== undefined) await db.queue.update(job.id, { ...progress });
}

/**
 * Re-orders fan jobs within their place in line. Only jobs that haven't started (no cursor)
 * move: a started job already has its rank from what its first step learned.
 */
export async function rankFanJobs(db: DigheadDb, ranks: Map<number, number>): Promise<void> {
  if (ranks.size === 0) return;
  await db.transaction('rw', db.queue, async () => {
    await db.queue
      .where('[kind+target]')
      .anyOf([...ranks.keys()].map((fanId) => ['fan', `${fanId}`]))
      .filter((job) => job.cursor === null)
      .modify((job) => {
        job.rank = ranks.get(Number(job.target)) ?? job.rank;
      });
  });
}

/**
 * Makes one release the foreground scan: its job and its supporters' jobs move to `priority`,
 * and jobs already at that priority (an earlier release's) move back to `otherwise`.
 */
export async function focusRelease(
  db: DigheadDb,
  release: ItemKey,
  supporterIds: number[],
  priority: number,
  otherwise: number,
): Promise<void> {
  const mine = new Set<string>([`release:${release}`, ...supporterIds.map((id) => `fan:${id}`)]);
  await db.transaction('rw', db.queue, async () => {
    await db.queue
      .where('[priority+nextAttemptAt+rank]')
      .between([priority, -Infinity, -Infinity], [priority, Infinity, Infinity])
      .filter((job) => !mine.has(`${job.kind}:${job.target}`))
      .modify({ priority: otherwise });
    await db.queue
      .where('[kind+target]')
      .anyOf([['release', release], ...supporterIds.map((id) => ['fan', `${id}`])])
      .modify({ priority });
  });
}

export async function countJobs(db: DigheadDb): Promise<Record<QueueJob['kind'], number>> {
  const [release, fan] = await Promise.all([
    db.queue.where('[kind+target]').between(['release', ''], ['release', '￿']).count(),
    db.queue.where('[kind+target]').between(['fan', ''], ['fan', '￿']).count(),
  ]);
  return { release, fan };
}
