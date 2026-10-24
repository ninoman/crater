// Shapes of For-you results, shared by the worker and the profile page.

import type { ItemKey } from '../bandcamp';
import type { HideScopes } from './hide';
import type { CrateMatesBasis } from './crateMates';

/**
 * All time draws on the crate mates leaderboard; Fresh on lately crate mates' buys of the last year (§11);
 * Deep cuts on releases few own but your top crate mates do (§18).
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
  /** How many of your top crate mates own it: "owned by 5 of your top crate mates". */
  crateMates: number;
  /**
   * Its owners: Bandcamp's count, at least `crateMates`. Deep cuts always has Bandcamp's count
   * ("Only 4 owners on Bandcamp"); the other modes fall back to the owners we've seen.
   */
  supporters: number;
  /** Rank of the most alike crate mate owning it, on the board the mode draws on ("your #3 crate mate"). */
  bestCrateMateRank: number | null;
  /** Fresh only: the newest purchase of it among those crate mates (ms). Null in All time. */
  lastBoughtAt: number | null;
  /** The artist or label you follow behind it, when that lifted it (decisions §16). */
  followed: string | null;
  /** You've heard it: badged and dimmed, or left out with "Hide heard" (decisions §22). */
  heard: boolean;
  /** The artist and label its hide menu offers. */
  hide: HideScopes;
}

export interface ForYouResult {
  /** Same as the crate mates leaderboard's: why there may be no crate mates to draw on. */
  basis: CrateMatesBasis;
  /** Best first, at most FOR_YOU_LIMIT. */
  rows: ForYouRow[];
  /** Top crate mates the picks came from: up to settings.topCrateMatesK. 0 means no crate mates yet (on that board). */
  crateMatesUsed: number;
}
