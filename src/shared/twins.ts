// Shapes of the taste-twins leaderboard, shared by the worker and the profile page.

/**
 * Which way a twin is heading, from their lately score now and a year ago (decisions §11).
 * `new`: they bought too little a year ago to compare. `quiet`: they've bought too little lately.
 */
export type Trend = 'converging' | 'steady' | 'drifting' | 'new' | 'quiet';

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
  /** In step with your recent buying, null when either of you bought too little lately. */
  lately: number | null;
  /** Releases you both bought within the last year. */
  latelyOverlap: number;
  trend: Trend;
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
  /** The fans most in step with you lately, best first. Ranks are places on this list. */
  latelyRows: TwinRow[];
  /** The lately half-life setting, for the note under the list. */
  latelyHalfLifeMonths: number;
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
