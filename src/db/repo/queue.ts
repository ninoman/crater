import type { ItemKey } from '../../bandcamp';
import type { DigheadDb, FanJob, QueueJob, ReleaseJob } from '../schema';

/** What to scan. A job is unique per kind and target. */
export type JobSpec = Pick<ReleaseJob, 'kind' | 'target' | 'url'> | Pick<FanJob, 'kind' | 'target'>;

export function fanJob(fanId: number): JobSpec {
  return { kind: 'fan', target: `${fanId}` };
}

function newJob(spec: JobSpec, priority: number, at: number): QueueJob {
  return { ...spec, priority, attempts: 0, nextAttemptAt: at, cursor: null } as QueueJob;
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
  entries: { spec: JobSpec; at: number }[],
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
    for (const { spec, at } of entries) {
      const key = `${spec.kind}:${spec.target}`;
      const job = byKey.get(key);
      if (!job) {
        const added = newJob(spec, priority, at);
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

/** The most urgent job that is due: lowest priority first, then earliest nextAttemptAt. */
export function nextJob(db: DigheadDb, now: number): Promise<QueueJob | undefined> {
  return db.queue
    .orderBy('[priority+nextAttemptAt]')
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

/** Saves how far a multi-request job got, so a killed worker resumes instead of restarting. */
export async function saveCursor(db: DigheadDb, job: QueueJob, cursor: QueueJob['cursor']) {
  if (job.id !== undefined) await db.queue.update(job.id, { cursor });
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
      .where('[priority+nextAttemptAt]')
      .between([priority, -Infinity], [priority, Infinity])
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
