// Shapes of hiding from recommendations (decisions §22), shared by the worker, the rows and the popup.

import type { ItemKey } from '../bandcamp';

/** What a hide takes out of every recommender, for good, until unhidden. */
export type HideTarget =
  | { kind: 'release'; matchKey: ItemKey }
  /** A selling account: the artist's own. Checked per item, so it catches releases seen later. */
  | { kind: 'band'; bandId: number; name: string }
  /** A label: releases carrying its id, and those it sells from its own account. */
  | { kind: 'label'; labelId: number; name: string };

export type HideKind = HideTarget['kind'];
export type BandHide = Extract<HideTarget, { kind: 'band' }>;
export type LabelHide = Extract<HideTarget, { kind: 'label' }>;

/** The wider hides a row offers beyond the release itself. Null where the account isn't known. */
export interface HideScopes {
  band: BandHide | null;
  label: LabelHide | null;
}

/** One line of the popup's Hidden list. */
export interface HiddenEntry {
  target: HideTarget;
  /** "Artist – Title" for a release, the account's name otherwise. */
  name: string;
  /** The release's page, when it's known. */
  url: string | null;
  hiddenAt: number;
}

/** One string per target, for React keys and comparing targets. Names don't count. */
export function hideTargetKey(target: HideTarget): string {
  switch (target.kind) {
    case 'release':
      return `release:${target.matchKey}`;
    case 'band':
      return `band:${target.bandId}`;
    case 'label':
      return `label:${target.labelId}`;
  }
}
