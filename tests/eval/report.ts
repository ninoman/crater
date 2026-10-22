// Text report of an eval run: aggregate numbers only, never releases or fans. Pure.

import { barVerdict, type AggRow, type Stat } from './aggregate';
import { KS, type K } from './types';

export interface SplitResult {
  name: string;
  folds: number;
  /** Releases held out in each fold, for judging how noisy the numbers are. */
  heldOut: number[];
  rows: AggRow[];
}

export const CAVEATS = [
  'Leakage: held-out releases are removed from your lists and the twin board is recomputed, but',
  'some fans are in the database only because they bought a held-out release (the scanner found',
  'them through its supporters). That residual leakage favours every method; the temporal split',
  'limits it.',
  'Plain recall favours popular releases, so it understates Deep cuts: judge on niche recall.',
  'With few held-out releases (~20% of your collection, a fraction of them niche) the folds are',
  'noisy: read the ± spread before trusting a difference.',
  'Not applied: artist diversity, the compilation down-weight and the follow boost.',
];

const pct = (s: Stat | null) =>
  s ? `${(s.mean * 100).toFixed(1)}±${(s.sd * 100).toFixed(1)}` : '–';
const num = (s: Stat | null) => (s ? `${s.mean.toFixed(1)}±${s.sd.toFixed(1)}` : '–');

function header(): string {
  const cols = KS.flatMap((k) => [`R@${k}`, `NR@${k}`, `ARP@${k}`, `medN@${k}`, `t=1@${k}`]);
  return ['method'.padEnd(34), ...cols.map((c) => c.padStart(11))].join(' ');
}

function line(row: AggRow, note: string): string {
  const cells = KS.flatMap((k: K) => [
    pct(row.at[k].recall),
    pct(row.at[k].nicheRecall),
    num(row.at[k].arp),
    num(row.at[k].medianHitN),
    pct(row.at[k].singleTwinShare),
  ]);
  return [
    `${row.label} [niche n≤${row.nicheCap}]`.padEnd(34),
    ...cells.map((c) => c.padStart(11)),
    note,
  ].join(' ');
}

/** Baselines, then the `top` Deep cuts rows by niche recall@30 (all of them when top is null). */
export function formatSplit(split: SplitResult, top: number | null): string {
  const rows = split.rows;
  const forYouAt = (cap: number) => rows.find((r) => r.kind === 'forYou' && r.nicheCap === cap);
  const deep = rows
    .filter((r) => r.kind === 'deepCuts')
    .sort((a, b) => (b.at[30].nicheRecall?.mean ?? 0) - (a.at[30].nicheRecall?.mean ?? 0));
  const shown = top === null ? deep : deep.slice(0, top);
  const out = [
    `== ${split.name}: ${split.folds} fold(s), held out per fold: ${split.heldOut.join(', ')}`,
    'Recall columns are % ; ARP is mean log2(1+n) ; medN is the median n of hits ; t=1 is % of list.',
    header(),
    ...rows.filter((r) => r.kind !== 'deepCuts').map((r) => line(r, '')),
    `-- Deep cuts, top ${shown.length} of ${deep.length} by niche recall@30`,
    ...shown.map((row) => {
      const base = forYouAt(row.nicheCap);
      const verdict = base ? barVerdict(row, base) : null;
      return line(row, verdict ? (verdict.met ? '  BAR MET' : '  bar not met') : '');
    }),
    `-- ${
      deep.filter((r) => {
        const b = forYouAt(r.nicheCap);
        return b && barVerdict(r, b).met;
      }).length
    } of ${deep.length} Deep cuts configs meet the bar (niche recall@30 ≥ 1.5× For you, median hit n < 1/5 of For you's)`,
  ];
  return out.join('\n');
}

export function formatReport(splits: readonly SplitResult[], top: number | null): string {
  const caveats = CAVEATS.map((line) => `  ${line}`).join('\n');
  return `${splits.map((s) => formatSplit(s, top)).join('\n\n')}\n\nCaveats:\n${caveats}`;
}
