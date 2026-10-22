// Shapes of the crate-mates leaderboard, shared by the worker and the profile page.

import type { ItemKey } from '../bandcamp';

/**
 * Which way a crate mate is heading, from their lately score now and a year ago (decisions §11).
 * `new`: they bought too little a year ago to compare. `quiet`: they've bought too little lately.
 */
export type Trend = 'converging' | 'steady' | 'drifting' | 'new' | 'quiet';

export interface CrateMateRow {
  fanId: number;
  /** Place on the leaderboard, by score: 1 is your closest crate mate. */
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
  /** A fan you follow on Bandcamp. Shown, never scored (decisions §16). */
  followed: boolean;
  /** In step with your recent buying, null when either of you bought too little lately. */
  lately: number | null;
  /** Releases you both bought within the last year. */
  latelyOverlap: number;
  trend: Trend;
  /** What they bought last, newest first. */
  recentBuys: CrateMateBuy[];
}

/** A release a crate mate bought, enough to show its cover and preview it. */
export interface CrateMateBuy {
  /** The album for album tracks (decisions §3.8). */
  matchKey: ItemKey;
  title: string;
  artist: string;
  url: string;
  coverUrl: string | null;
  boughtAt: number;
}

/** Why the leaderboard may be empty, so the page can say what to do next. */
export type CrateMatesBasis =
  /** The worker hasn't seen you logged in yet. */
  | 'no-viewer'
  /** Your collection hasn't finished its first sync. */
  | 'unsynced'
  | 'ready';

export interface CrateMatesResult {
  basis: CrateMatesBasis;
  /** Best first. */
  rows: CrateMateRow[];
  /** The fans most in step with you lately, best first. Ranks are places on this list. */
  latelyRows: CrateMateRow[];
  /** The lately half-life setting, for the note under the list. */
  latelyHalfLifeMonths: number;
  /** When the leaderboard was last worked out, or null if never. */
  computedAt: number | null;
  /** Fans whose collection we've read: the pool crate mates come from. */
  fansRead: number;
}

/** Where one fan stands among your crate mates, for the badge on their profile. */
export interface CrateMateStanding {
  /** Place on the all-time leaderboard, 1 for your closest crate mate. Null when only on the lately one. */
  rank: number | null;
  /** Place on the lately leaderboard. Null when only on the all-time one. */
  latelyRank: number | null;
  /** Releases you both own. */
  overlap: number;
  /** Jaccard as a percentage (0 to 100). */
  matchPct: number;
}
