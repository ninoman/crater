// Shapes of For-you results, shared by the worker and the profile page.

import type { ItemKey } from '../bandcamp';
import type { TwinsBasis } from './twins';

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
}

export interface ForYouResult {
  /** Same as the twins leaderboard's: why there may be no twins to draw on. */
  basis: TwinsBasis;
  /** Best first, at most FOR_YOU_LIMIT. */
  rows: ForYouRow[];
  /** Top twins the picks came from: up to settings.topTwinsK. 0 means no twins yet. */
  twinsUsed: number;
}
