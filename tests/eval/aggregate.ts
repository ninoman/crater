// Folds' metrics summed up as mean and spread, and the success bar. Pure.

import { KS, type FoldRow, type K, type ListMetrics, type MethodKind } from './types';

export interface Stat {
  mean: number;
  /** Sample standard deviation across folds, 0 for a single fold. */
  sd: number;
  /** Folds that had a value: a fold with no niche release or no hit has none. */
  folds: number;
}

export type MetricName = keyof ListMetrics;
export const METRICS: readonly MetricName[] = [
  'recall',
  'nicheRecall',
  'arp',
  'medianHitN',
  'singleTwinShare',
];

export interface AggRow {
  kind: MethodKind;
  label: string;
  nicheCap: number;
  at: Record<K, Record<MetricName, Stat | null>>;
}

export function stat(values: readonly (number | null)[]): Stat | null {
  const present = values.filter((v): v is number => v !== null);
  if (present.length === 0) return null;
  const mean = present.reduce((a, b) => a + b, 0) / present.length;
  const variance =
    present.length < 2
      ? 0
      : present.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (present.length - 1);
  return { mean, sd: Math.sqrt(variance), folds: present.length };
}

/** One row per method and niche cap, over the folds that ran it. */
export function aggregate(folds: readonly (readonly FoldRow[])[]): AggRow[] {
  const groups = new Map<string, FoldRow[]>();
  for (const rows of folds) {
    for (const row of rows) {
      const key = `${row.label}|${row.nicheCap}`;
      groups.set(key, [...(groups.get(key) ?? []), row]);
    }
  }
  return [...groups.values()].flatMap((rows) => {
    const first = rows[0];
    if (!first) return [];
    const at = Object.fromEntries(
      KS.map((k) => [
        k,
        Object.fromEntries(METRICS.map((m) => [m, stat(rows.map((r) => r.at[k][m]))])),
      ]),
    ) as AggRow['at'];
    return [{ kind: first.kind, label: first.label, nicheCap: first.nicheCap, at }];
  });
}

/** The bar from the research doc: niche recall@30 at least this × For you's... */
export const NICHE_RECALL_GAIN = 1.5;
/** ...and the median n of the hits under this share of For you's. */
export const MEDIAN_HIT_N_SHARE = 1 / 5;

export interface BarVerdict {
  met: boolean;
  /** Deep cuts' niche recall@30 over For you's, null when For you found none. */
  nicheGain: number | null;
  /** Deep cuts' median hit n over For you's, null when either found no hits. */
  medianShare: number | null;
}

/** Whether a Deep cuts row meets the bar against For you at the same niche cap. */
export function barVerdict(deep: AggRow, forYou: AggRow): BarVerdict {
  const deepRecall = deep.at[30].nicheRecall?.mean ?? 0;
  const baseRecall = forYou.at[30].nicheRecall?.mean ?? 0;
  const deepMedian = deep.at[30].medianHitN?.mean ?? null;
  const baseMedian = forYou.at[30].medianHitN?.mean ?? null;
  const nicheGain = baseRecall === 0 ? null : deepRecall / baseRecall;
  const medianShare =
    deepMedian === null || baseMedian === null || baseMedian === 0 ? null : deepMedian / baseMedian;
  const gainMet = baseRecall === 0 ? deepRecall > 0 : deepRecall >= NICHE_RECALL_GAIN * baseRecall;
  const medianMet = medianShare !== null && medianShare < MEDIAN_HIT_N_SHARE;
  return { met: gainMet && medianMet, nicheGain, medianShare };
}
