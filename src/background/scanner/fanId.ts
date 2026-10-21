import type { FanJob } from '../../db';

export function fanIdOf(job: FanJob): number {
  return Number(job.target);
}
