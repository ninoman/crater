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

/** The Deep cuts reason line, e.g. "Only 4 owners on Bandcamp · 3 are your twins". */
export function formatDeepCutReason(
  row: Pick<ForYouRow, 'twins' | 'supporters' | 'bestTwinRank'>,
): string {
  const owners = `Only ${row.supporters} ${row.supporters === 1 ? 'owner' : 'owners'} on Bandcamp`;
  const twin = row.bestTwinRank === null ? 'twin' : `#${row.bestTwinRank} twin`;
  if (row.twins >= row.supporters) {
    return `${owners}, ${row.supporters === 1 ? `your ${twin}` : 'all your twins'}`;
  }
  if (row.twins === 1) return `${owners} · one is your ${twin}`;
  return `${owners} · ${row.twins} are your twins`;
}

/** The All-time reason line, e.g. "owned by 5 of your top twins". */
function formatTwinOwners(twins: number): string {
  return `owned by ${twins} of your top twins`;
}

/** The line above the list, e.g. "30 picks from what your 30 closest twins own". */
export function formatForYouSummary(picks: number, twins: number, mode: ForYouMode): string {
  if (mode === 'deep') {
    return `${picks} ${picks === 1 ? 'deep cut' : 'deep cuts'} from what your ${twins === 1 ? 'closest twin owns' : `${twins} closest twins own`}`;
  }
  const count = `${picks} ${picks === 1 ? 'pick' : 'picks'}`;
  if (mode === 'fresh') {
    return `${count} from what your ${twins === 1 ? 'lately twin' : `${twins} lately twins`} bought this year`;
  }
  return `${count} from what your ${twins === 1 ? 'closest twin owns' : `${twins} closest twins own`}`;
}
