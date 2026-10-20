// Shapes of the "Twins who own this" list, shared by the worker and the sidebar.

import type { ItemKey } from '../bandcamp';

export interface ReleaseTwinRow {
  fanId: number;
  /** Place on your twins leaderboard, 1 for your closest twin. */
  rank: number;
  name: string;
  profileUrl: string;
  /** Releases you both own. */
  overlap: number;
  /** Their overlap with you is mostly one label they collect wholesale (decisions §7). */
  labelCluster: boolean;
}

export interface ReleaseTwinsResult {
  releaseKey: ItemKey;
  /** Your twins who own the release, closest first. */
  rows: ReleaseTwinRow[];
  /** Twins on the leaderboard at all, so the sidebar can tell "none yet" from "none own this". */
  twinCount: number;
}
