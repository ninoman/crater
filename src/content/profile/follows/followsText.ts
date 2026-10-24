// The words on New from your follows (decisions §22).

const DAY_MS = 24 * 60 * 60 * 1000;
const days = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

/** "today", "yesterday", "3 days ago", or for a pre-order "out in 5 days". Release dates are days. */
export function formatWhen(at: number, now: number, preorder: boolean): string {
  const startOfDay = (ms: number) => Math.floor(ms / DAY_MS);
  const diff = startOfDay(at) - startOfDay(now);
  if (diff > 0) return `${preorder ? 'pre-order, ' : ''}out ${days.format(diff, 'day')}`;
  return days.format(diff, 'day');
}

/** "3 of your top crate mates buy from them", or nothing when none do. */
export function formatInterest(crateMates: number): string | null {
  if (crateMates === 0) return null;
  return crateMates === 1
    ? 'one of your top crate mates buys from them'
    : `${crateMates} of your top crate mates buy from them`;
}

/** The reason line under a row. */
export function formatFollowsReason(
  row: { newsAt: number; preorder: boolean; crateMates: number },
  now: number,
): string {
  return [formatWhen(row.newsAt, now, row.preorder), formatInterest(row.crateMates)]
    .filter((part) => part !== null)
    .join(' · ');
}

/** The followed accounts behind a row, when they aren't just the artist: "Warp", "Warp & Ninja Tune". */
export function formatAccounts(names: readonly string[], artist: string): string | null {
  const others = names.filter((name) => name.toLowerCase() !== artist.toLowerCase());
  return others.length > 0 ? others.join(' & ') : null;
}

/** "14 releases from the 212 artists and labels you follow, last 60 days". */
export function formatFollowsSummary(rows: number, accounts: number, windowDays: number): string {
  const releases = `${rows} ${rows === 1 ? 'release' : 'releases'}`;
  const who =
    accounts === 1
      ? 'the artist or label you follow'
      : `the ${accounts} artists and labels you follow`;
  return `${releases} from ${who}, last ${windowDays} days`;
}

/** While reads are queued: "Checked 120 of 212 accounts". */
export function formatChecked(read: number, accounts: number): string {
  return `Checked ${read} of ${accounts} ${accounts === 1 ? 'account' : 'accounts'}`;
}
