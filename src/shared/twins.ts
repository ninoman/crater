// Shapes of the taste-twins leaderboard, shared by the worker and the profile page.

export interface TwinRow {
  fanId: number;
  /** Place on the leaderboard, by score: 1 is your closest twin. */
  rank: number;
  username: string;
  name: string;
  avatarUrl: string | null;
  /** Their Bandcamp profile. */
  url: string;
  /** Releases you both own. */
  overlap: number;
  /** Shared releases over both collections combined: the "% match". */
  jaccard: number;
  score: number;
  /** Most of the overlap is one label they collect wholesale (decisions §7). */
  labelCluster: boolean;
}

/** Why the leaderboard may be empty, so the page can say what to do next. */
export type TwinsBasis =
  /** The worker hasn't seen you logged in yet. */
  | 'no-viewer'
  /** Your collection hasn't finished its first sync. */
  | 'unsynced'
  | 'ready';

export interface TwinsResult {
  basis: TwinsBasis;
  /** Best first. */
  rows: TwinRow[];
  /** When the leaderboard was last worked out, or null if never. */
  computedAt: number | null;
  /** Fans whose collection we've read: the pool twins come from. */
  fansRead: number;
}

/** Where one fan stands among your twins, for the badge on their profile. */
export interface TwinStanding {
  /** Place on the leaderboard, 1 for your closest twin. */
  rank: number;
  /** Releases you both own. */
  overlap: number;
  /** Jaccard as a percentage (0 to 100). */
  matchPct: number;
}
