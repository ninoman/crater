// Shapes of the Twins' latest feed, shared by the worker and the profile page.

import type { ItemKey } from '../bandcamp';
import type { TwinsBasis } from './twins';

/** A twin who bought a release in the feed. */
export interface LatestBuyer {
  fanId: number;
  name: string;
  /** Their Bandcamp profile. */
  url: string;
}

export interface TwinsLatestRow {
  /** The album for album tracks (decisions §3.8). Hide uses this. */
  matchKey: ItemKey;
  title: string;
  artist: string;
  label: string | null;
  url: string;
  coverUrl: string | null;
  /** The newest purchase of it among your twins, in ms. */
  boughtAt: number;
  /** Who bought it in the window, lately board first. */
  buyers: LatestBuyer[];
}

export interface TwinsLatestResult {
  basis: TwinsBasis;
  /** Newest purchase first. */
  rows: TwinsLatestRow[];
  /** Twins the feed was read from: the top of the lately board, then of the all-time one. */
  twinsUsed: number;
  /** How far back purchases count. */
  windowDays: number;
  /** Of those twins, how many have a scan waiting, so the feed may grow shortly. */
  checking: number;
}
