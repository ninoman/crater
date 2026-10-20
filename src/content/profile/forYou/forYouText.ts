/** The reason line under a For-you pick. */
export function formatTwinOwners(twins: number): string {
  return `owned by ${twins} of your top twins`;
}

/** The line above the list, e.g. "30 picks from what your 30 closest twins own". */
export function formatForYouSummary(picks: number, twins: number): string {
  return `${picks} ${picks === 1 ? 'pick' : 'picks'} from what your ${twins === 1 ? 'closest twin owns' : `${twins} closest twins own`}`;
}
