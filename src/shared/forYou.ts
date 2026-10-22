// Shapes of For-you results, shared by the worker and the profile page.

import type { ItemKey } from '../bandcamp';
import type { TwinsBasis } from './twins';

/**
 * All time draws on the twins leaderboard; Fresh on lately twins' buys of the last year (§11);
 * Deep cuts on releases few own but your top twins do (§18).
 */
export type ForYouMode = 'all' | 'fresh' | 'deep';

export interface ForYouRow {
  /** What was ranked: the album for album tracks (decisions §3.8). Hide uses this. */
  matchKey: ItemKey;
  title: string;
  artist: string;
  label: string | null;
  /** The album's page, or one of its tracks' when only tracks of it have turned up. */
  url: string;
  coverUrl: string | null;
  /** How many of your top twins own it: "owned by 5 of your top twins". */
  twins: number;
  /**
   * Its owners: Bandcamp's count, at least `twins`. Deep cuts always has Bandcamp's count
   * ("Only 4 owners on Bandcamp"); the other modes fall back to the owners we've seen.
   */
  supporters: number;
  /** Rank of the most alike twin owning it, on the board the mode draws on ("your #3 twin"). */
  bestTwinRank: number | null;
  /** Fresh only: the newest purchase of it among those twins (ms). Null in All time. */
  lastBoughtAt: number | null;
  /** The artist or label you follow behind it, when that lifted it (decisions §16). */
  followed: string | null;
}

export interface ForYouResult {
  /** Same as the twins leaderboard's: why there may be no twins to draw on. */
  basis: TwinsBasis;
  /** Best first, at most FOR_YOU_LIMIT. */
  rows: ForYouRow[];
  /** Top twins the picks came from: up to settings.topTwinsK. 0 means no twins yet (on that board). */
  twinsUsed: number;
}
