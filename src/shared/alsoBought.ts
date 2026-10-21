// Shapes of Also-bought results, shared by the worker and the sidebar.

import type { ItemKey } from '../bandcamp';

/** Why a release is recommended. The UI turns this into the reason line. */
export type AlsoBoughtReason =
  /** `owners` of the `of` scanned supporters own it, `twins` of them your taste twins. */
  | { kind: 'co-owned'; owners: number; of: number; twins: number }
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
  /** Tracks of this album you already own. */
  ownedTracks: number;
}

export interface AlsoBoughtResult {
  releaseKey: ItemKey;
  rows: AlsoBoughtRow[];
}
