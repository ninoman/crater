// Shapes shared by the eval's pure modules.

import type { TwinOwned } from '../../src/scoring/forYou';

/** A release owned by at least one of the top twins, with what the methods need to rank it. */
export interface Candidate extends TwinOwned {
  /** Bandcamp's owner count, null when no item record has one. */
  supporters: number | null;
  /** Owners seen locally: For you's fallback when Bandcamp gave no count. */
  owners: number;
}

/** How widely a release is owned, for ARP and the niche cut. */
export interface Popularity {
  supporters: number | null;
  owners: number;
}

export type MethodKind = 'popularity' | 'forYou' | 'edge' | 'deepCuts';

export interface DeepCutParams {
  beta: number;
  agreement: number;
  cap: number;
}

export interface MethodSpec {
  kind: MethodKind;
  label: string;
  /** How many top twins the method draws on. */
  twinsK: number;
  /** The cap the method itself applies, null when it has none. */
  cap: number | null;
  /** Best first, at most `limit` long. */
  rank(candidates: readonly Candidate[], limit: number): Candidate[];
}

export const KS = [30, 100] as const;
export type K = (typeof KS)[number];

export interface ListMetrics {
  recall: number;
  /** Null when the fold holds out no niche release. */
  nicheRecall: number | null;
  /** Mean log2(1 + n) of the list, null for an empty list. */
  arp: number | null;
  /** Median n of the hits, null when nothing was hit. */
  medianHitN: number | null;
  /** Share of the list backed by a single twin, null for an empty list. */
  singleTwinShare: number | null;
}

/** One method on one fold, at one definition of "niche". */
export interface FoldRow {
  kind: MethodKind;
  label: string;
  nicheCap: number;
  at: Record<K, ListMetrics>;
}
