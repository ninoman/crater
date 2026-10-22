import type { ForYouMode, ForYouRow } from '../../../shared/forYou';
import { timeAgo } from '../../../shared/timeAgo';

/** The reason line under a For-you pick. Fresh says when a crate mate last bought it. */
export function formatPickReason(
  row: Pick<ForYouRow, 'crateMates' | 'lastBoughtAt'>,
  now: number,
): string {
  if (row.lastBoughtAt === null) return formatCrateMateOwners(row.crateMates);
  return `bought by ${row.crateMates} of your lately crate mates · latest ${timeAgo(row.lastBoughtAt, now)}`;
}

/** The Deep cuts reason line, e.g. "Only 4 owners on Bandcamp · 3 are your crate mates". */
export function formatDeepCutReason(
  row: Pick<ForYouRow, 'crateMates' | 'supporters' | 'bestCrateMateRank'>,
): string {
  const owners = `Only ${row.supporters} ${row.supporters === 1 ? 'owner' : 'owners'} on Bandcamp`;
  const crateMate =
    row.bestCrateMateRank === null ? 'crate mate' : `#${row.bestCrateMateRank} crate mate`;
  if (row.crateMates >= row.supporters) {
    return `${owners}, ${row.supporters === 1 ? `your ${crateMate}` : 'all your crate mates'}`;
  }
  if (row.crateMates === 1) return `${owners} · one is your ${crateMate}`;
  return `${owners} · ${row.crateMates} are your crate mates`;
}

/** The All-time reason line, e.g. "owned by 5 of your top crate mates". */
function formatCrateMateOwners(crateMates: number): string {
  return `owned by ${crateMates} of your top crate mates`;
}

/** The line above the list, e.g. "30 picks from what your 30 closest crate mates own". */
export function formatForYouSummary(picks: number, crateMates: number, mode: ForYouMode): string {
  if (mode === 'deep') {
    return `${picks} ${picks === 1 ? 'deep cut' : 'deep cuts'} from what your ${crateMates === 1 ? 'closest crate mate owns' : `${crateMates} closest crate mates own`}`;
  }
  const count = `${picks} ${picks === 1 ? 'pick' : 'picks'}`;
  if (mode === 'fresh') {
    return `${count} from what your ${crateMates === 1 ? 'lately crate mate' : `${crateMates} lately crate mates`} bought this year`;
  }
  return `${count} from what your ${crateMates === 1 ? 'closest crate mate owns' : `${crateMates} closest crate mates own`}`;
}
