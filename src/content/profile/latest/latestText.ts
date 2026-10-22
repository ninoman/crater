import { timeAgo } from '../../../shared/timeAgo';
import type { LatestBuyer } from '../../../shared/twinsLatest';

/** Names shown before the rest are counted. */
const NAMED_BUYERS = 2;

/** "bought by Ana", "bought by Ana and Ben", "bought by Ana, Ben and 3 more". */
export function formatBuyers(buyers: readonly Pick<LatestBuyer, 'name'>[]): string {
  const names = buyers.map((buyer) => buyer.name);
  if (names.length <= NAMED_BUYERS) return `bought by ${names.join(' and ')}`;
  const rest = names.length - NAMED_BUYERS;
  return `bought by ${names.slice(0, NAMED_BUYERS).join(', ')} and ${rest} more`;
}

/** The line above the list, e.g. "12 releases your 40 top twins bought in the last 60 days". */
export function formatLatestSummary(rows: number, twins: number, windowDays: number): string {
  const releases = `${rows} ${rows === 1 ? 'release' : 'releases'}`;
  const who = twins === 1 ? 'your top twin' : `your ${twins} top twins`;
  return `${releases} ${who} bought in the last ${windowDays} days`;
}

/** While some of those twins have a scan waiting. */
export function formatChecking(twins: number): string {
  return `Checking ${twins} ${twins === 1 ? 'twin' : 'twins'} for new purchases`;
}

/** The reason line under a row: "bought by Ana and Ben · 3 days ago". */
export function formatLatestReason(
  row: { buyers: readonly Pick<LatestBuyer, 'name'>[]; boughtAt: number },
  now: number,
): string {
  return `${formatBuyers(row.buyers)} · ${timeAgo(row.boughtAt, now)}`;
}
