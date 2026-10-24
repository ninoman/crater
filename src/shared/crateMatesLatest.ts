// Shapes of the Crate mates' latest feed, shared by the worker and the profile page.

import type { ItemKey } from '../bandcamp';
import type { CrateMatesBasis } from './crateMates';
import type { AppliedFilters } from './listFilters';

/** A crate mate who bought a release in the feed. */
export interface LatestBuyer {
  fanId: number;
  name: string;
  /** Their Bandcamp profile. */
  url: string;
}

export interface CrateMatesLatestRow {
  /** The album for album tracks (decisions §3.8). Hide uses this. */
  matchKey: ItemKey;
  title: string;
  artist: string;
  label: string | null;
  url: string;
  coverUrl: string | null;
  /** The newest purchase of it among your crate mates, in ms. */
  boughtAt: number;
  /** Who bought it in the window, lately board first. */
  buyers: LatestBuyer[];
}

export interface CrateMatesLatestResult {
  basis: CrateMatesBasis;
  /** Newest purchase first. */
  rows: CrateMatesLatestRow[];
  /** Crate mates the feed was read from: the top of the lately board, then of the all-time one. */
  crateMatesUsed: number;
  /** How far back purchases count. */
  windowDays: number;
  /** Of those crate mates, how many have a scan waiting, so the feed may grow shortly. */
  checking: number;
  /** The request's filters and what they did; absent when none narrowed the feed (decisions §22). */
  filtered?: AppliedFilters;
}
