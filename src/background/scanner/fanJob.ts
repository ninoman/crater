// A fan job, one request per run, in stages (decisions §12): the profile page (pass 1), a quick
// read around their purchase of the release (pass 2), then the full collection.

import { finishFanScan, getMe, type FanJob } from '../../db';
import type { StepContext, StepResult } from './context';
import { fanIdOf } from './fanId';
import { fullStep, quickStep } from './fanCollectionStep';
import { latestStep } from './fanLatestStep';
import { profileStep } from './fanProfileStep';
import { SEED } from './priority';

export { fanIdOf };

/** Runs one step: the next request this fan's scan needs. */
export async function runFanStep(ctx: StepContext, job: FanJob): Promise<StepResult> {
  switch (job.cursor?.stage) {
    case 'quick':
      return quickStep(ctx, job);
    case 'full':
      return fullStep(ctx, job, job.cursor);
    case 'latest':
      return latestStep(ctx, job, job.cursor);
    default:
      return firstStep(ctx, job);
  }
}

/**
 * Seed scans fill twins, not a page you're looking at, so they go straight to the full scan.
 * Logged out, the profile has no count, so the quick read comes first.
 */
async function firstStep(ctx: StepContext, job: FanJob): Promise<StepResult> {
  if (job.priority >= SEED) return fullStep(ctx, job, null);
  if (!(await getMe(ctx.db))) return quickStep(ctx, job);
  return profileStep(ctx, job);
}

/** A fan whose job was dropped after failing. */
export async function abandonFan(ctx: StepContext, job: FanJob): Promise<void> {
  // A failed latest read leaves the collection on file as it was; the next round tries again.
  if (job.cursor?.stage === 'latest') return;
  const scanned = job.cursor?.stage === 'full' ? job.cursor.scanned : 0;
  await finishFanScan(ctx.db, fanIdOf(job), 'error', scanned, ctx.now);
}
