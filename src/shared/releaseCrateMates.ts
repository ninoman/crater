// Shapes of the "Crate mates who own this" list, shared by the worker and the sidebar.

import type { ItemKey } from '../bandcamp';

export interface ReleaseCrateMateRow {
  fanId: number;
  /** Place on your crate mates leaderboard, 1 for your closest crate mate. */
  rank: number;
  name: string;
  profileUrl: string;
  /** Releases you both own. */
  overlap: number;
  /** Their overlap with you is mostly one label they collect wholesale (decisions §7). */
  labelCluster: boolean;
}

export interface ReleaseCrateMatesResult {
  releaseKey: ItemKey;
  /** Your crate mates who own the release, closest first. */
  rows: ReleaseCrateMateRow[];
  /** Crate mates on the leaderboard at all, so the sidebar can tell "none yet" from "none own this". */
  crateMateCount: number;
}
