// What no recommender may suggest. Shared by Also bought, For you (every mode) and Crate mates'
// latest.

import { keyToNumber, type ItemKey } from '../bandcamp';

/** One ownership row of yours, as far as filtering cares. */
export interface MyRow {
  itemKey: ItemKey;
  matchKey: ItemKey;
  source: 'collection' | 'wishlist';
}

/** What you hid, by kind (decisions §22). Artists and labels are band account ids. */
export interface HiddenTargets {
  releases: ReadonlySet<ItemKey>;
  bands: ReadonlySet<number>;
  labels: ReadonlySet<number>;
}

/** An item's selling account and label, as `items` stores them. */
export interface Seller {
  bandId: number;
  labelId: number | null;
}

export interface ExclusionOptions {
  /** The release being recommended from, if any. */
  release?: ItemKey;
  /** matchKeys you've heard, only when the list asks to hide them. */
  heard?: ReadonlySet<ItemKey>;
}

export interface Exclusions {
  /** Match ids (keyToNumber) that never get recommended. */
  ids: Set<number>;
  /** Whether any artist or label is hidden, so callers can skip reading sellers when none is. */
  checksSellers: boolean;
  /**
   * False for an item from a hidden artist or label. Checked per item rather than turned into
   * ids up front, so releases that turn up after the hide are caught too.
   */
  allows: (item: Seller) => boolean;
}

/**
 * Leaves out hidden releases, releases you own or wishlisted as a whole, albums you own a track
 * of, the release being recommended from, and, when asked, releases you've heard. Owning a track
 * almost always means you've heard the album; wishlisting one doesn't, so that album stays in
 * (decisions §3.8). Hidden artists and labels are left out through `allows`. Hide always wins
 * over heard: a hidden release is out whether or not heard ones are.
 */
export function exclusions(
  mine: readonly MyRow[],
  hidden: HiddenTargets,
  { release, heard }: ExclusionOptions = {},
): Exclusions {
  const ids = new Set([...hidden.releases].map(keyToNumber));
  if (release !== undefined) ids.add(keyToNumber(release));
  for (const key of heard ?? []) ids.add(keyToNumber(key));
  for (const row of mine) {
    if (row.itemKey === row.matchKey || row.source === 'collection') {
      ids.add(keyToNumber(row.matchKey));
    }
  }
  return {
    ids,
    checksSellers: hidden.bands.size > 0 || hidden.labels.size > 0,
    allows: (item) => sellerAllowed(item, hidden),
  };
}

/**
 * A label sells either from its own account (`bandId`) or through the artist's, which names it
 * in `labelId` (decisions §3.3), so a hidden label is checked against both.
 */
function sellerAllowed({ bandId, labelId }: Seller, hidden: HiddenTargets): boolean {
  if (hidden.bands.has(bandId) || hidden.labels.has(bandId)) return false;
  return labelId === null || !hidden.labels.has(labelId);
}
