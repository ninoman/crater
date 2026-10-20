const format = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['day', 86_400_000],
  ['hour', 3_600_000],
  ['minute', 60_000],
];

/** "just now", "5 minutes ago", "yesterday", … */
export function timeAgo(then: number, now: number): string {
  const elapsed = Math.max(0, now - then);
  for (const [unit, ms] of UNITS) {
    if (elapsed >= ms) return format.format(-Math.floor(elapsed / ms), unit);
  }
  return 'just now';
}

/** "14:05": a time later today, e.g. when a pause ends. */
export function clockTime(at: number): string {
  return new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
