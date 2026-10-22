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

/** Jaccard as the "% match": 0.333 → "33%", 0.015 → "1.5%". */
export function formatMatch(jaccard: number): string {
  return percent.format(jaccard);
}

/** The score columns: All time's and Lately's. */
export type ScoreKey = 'score' | 'lately';

/** The best score on a board: the 100 the other twins are shown against. */
export function topScore(rows: readonly TwinRow[], key: ScoreKey): number {
  let top = 0;
  for (const row of rows) top = Math.max(top, row[key] ?? 0);
  return top;
}

/**
 * A score as a share of the board's best, so the top twin shows 100. Raw scores are tiny
 * (≈0.02) and unitless; only their ratios mean anything.
 */
export function formatRelativeScore(score: number, top: number): string {
  if (top <= 0 || score <= 0) return '0';
  const relative = Math.round((score / top) * 100);
  return relative === 0 ? '<1' : String(relative);
}

/** A trend as an arrow (decoration only) and a word that carries the meaning. */
export const TREND_LABELS: Record<Trend, { arrow: string; word: string }> = {
  converging: { arrow: '↑', word: 'closer' },
  steady: { arrow: '→', word: 'steady' },
  drifting: { arrow: '↓', word: 'apart' },
  new: { arrow: '', word: 'new' },
  quiet: { arrow: '', word: 'quiet' },
};
