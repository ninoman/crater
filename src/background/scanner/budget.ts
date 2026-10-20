// Daily request budget. The counter belongs to a local calendar day, so it resets at midnight.

export interface Budget {
  /** Local date, YYYY-MM-DD. */
  day: string;
  used: number;
}

export function localDay(now: number): string {
  const date = new Date(now);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function usedToday(budget: Budget | null, now: number): number {
  return budget?.day === localDay(now) ? budget.used : 0;
}

/** Counts one request against today's budget. */
export function spend(budget: Budget | null, now: number): Budget {
  return { day: localDay(now), used: usedToday(budget, now) + 1 };
}

export function budgetExhausted(budget: Budget | null, limit: number, now: number): boolean {
  return usedToday(budget, now) >= limit;
}

export function nextLocalMidnight(now: number): number {
  const date = new Date(now);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).getTime();
}
