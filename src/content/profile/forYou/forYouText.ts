import type { ForYouMode, ForYouRow } from '../../../shared/forYou';
import { timeAgo } from '../../../shared/timeAgo';

/** The reason line under a For-you pick. Fresh says when a twin last bought it. */
export function formatPickReason(
  row: Pick<ForYouRow, 'twins' | 'lastBoughtAt'>,
  now: number,
): string {
  if (row.lastBoughtAt === null) return formatTwinOwners(row.twins);
  return `bought by ${row.twins} of your lately twins · latest ${timeAgo(row.lastBoughtAt, now)}`;
}

/** The All-time reason line, e.g. "owned by 5 of your top twins". */
function formatTwinOwners(twins: number): string {
  return `owned by ${twins} of your top twins`;
}

/** The line above the list, e.g. "30 picks from what your 30 closest twins own". */
export function formatForYouSummary(picks: number, twins: number, mode: ForYouMode): string {
  const count = `${picks} ${picks === 1 ? 'pick' : 'picks'}`;
  if (mode === 'fresh') {
    return `${count} from what your ${twins === 1 ? 'lately twin' : `${twins} lately twins`} bought this year`;
  }
  return `${count} from what your ${twins === 1 ? 'closest twin owns' : `${twins} closest twins own`}`;
}
