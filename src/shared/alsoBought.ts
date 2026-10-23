// Shapes of Also-bought results, shared by the worker and the sidebar.

import type { ItemKey } from '../bandcamp';

/** Why a release is recommended. The UI turns this into the reason line. */
export type AlsoBoughtReason =
  /** `owners` of the scanned supporters own it, `crateMates` of them your crate mates. */
  | { kind: 'co-owned'; owners: number; crateMates: number }
  | { kind: 'same-artist' }
  /** `label` is null when the selling account is the label, since its name isn't known. */
  | { kind: 'same-label'; label: string | null };

export interface AlsoBoughtRow {
  /** What was ranked: the album for album tracks (decisions §3.8). Hide uses this. */
  matchKey: ItemKey;
  title: string;
  artist: string;
  label: string | null;
  /** The album's page, or one of its tracks' when only tracks of it have turned up. */
  url: string;
  coverUrl: string | null;
  reason: AlsoBoughtReason;
  /** The artist or label you follow behind it, when that lifted it (decisions §16). */
  followed: string | null;
}

/** How far the wait for trustworthy co-owned rows has got (decisions §12). */
export interface AlsoBoughtWarmup {
  /** Supporters read, up to `readTarget`. */
  read: number;
  readTarget: number;
  /** Rows passing the confidence bar, up to `confidentTarget`. */
  confident: number;
  confidentTarget: number;
}

export interface AlsoBoughtResult {
  releaseKey: ItemKey;
  /** During the warm-up, early picks: co-owned rows so far, then same-artist and same-label ones. */
  rows: AlsoBoughtRow[];
  /** Null once co-owned rows show. */
  warmup: AlsoBoughtWarmup | null;
}
