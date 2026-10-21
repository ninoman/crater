// Sorting, filtering and number formats for the twins leaderboard. Pure, so the table stays dumb.

import { foldText as fold } from '../../../shared/fold';
import type { Trend, TwinRow } from '../../../shared/twins';

/** All time ranks by overall overlap, Lately by how in step your recent buying is (§11). */
export type TwinBoard = 'all' | 'lately';

export type TwinSort = 'score' | 'overlap' | 'jaccard' | 'lately' | 'latelyOverlap';

/** Highest first, a missing lately score lowest. Ties keep leaderboard order. */
export function sortTwins(rows: readonly TwinRow[], by: TwinSort): TwinRow[] {
  return [...rows].sort((a, b) => (b[by] ?? -1) - (a[by] ?? -1) || a.rank - b.rank);
}

/** Twins whose name or username contains the query. A blank query keeps everyone. */
export function filterTwins(rows: readonly TwinRow[], query: string): TwinRow[] {
  const needle = fold(query.trim());
  if (needle === '') return [...rows];
  return rows.filter(
    (row) => fold(row.name).includes(needle) || fold(row.username).includes(needle),
  );
}

const percent = new Intl.NumberFormat('en', { style: 'percent', maximumSignificantDigits: 2 });
const decimal = new Intl.NumberFormat('en', { maximumSignificantDigits: 2 });

/** Jaccard as the "% match": 0.333 → "33%", 0.015 → "1.5%". */
export function formatMatch(jaccard: number): string {
  return percent.format(jaccard);
}

/** Scores are small and unitless; two significant digits are enough to compare them. */
export function formatScore(score: number): string {
  return decimal.format(score);
}

/** A trend as an arrow (decoration only) and a word that carries the meaning. */
export const TREND_LABELS: Record<Trend, { arrow: string; word: string }> = {
  converging: { arrow: '↑', word: 'closer' },
  steady: { arrow: '→', word: 'steady' },
  drifting: { arrow: '↓', word: 'apart' },
  new: { arrow: '', word: 'new' },
  quiet: { arrow: '', word: 'quiet' },
};
