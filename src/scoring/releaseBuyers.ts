// Whose collections an Also-bought list is built from, by page (decisions §3.8, §17). Pure:
// src/db passes the ownership rows under the release's matchKey.

import type { ItemKey } from '../bandcamp';

/**
 * On a compilation's track page, a buyer of the whole comp counts this much. They came for any
 * of its artists, and they're the same fans on every track: at full weight they'd outnumber the
 * track's own buyers and every track would show the same list.
 */
export const COMP_BUYER_WEIGHT = 0.5;

export interface BuyerPage {
  /** The release on the page: an album, a track of one, or a standalone track. */
  releaseKey: ItemKey;
  /** albumKey ?? itemKey: equal to releaseKey on an album page or a standalone track. */
  matchKey: ItemKey;
  compilation: boolean;
}

export interface BuyerRow {
  fanId: number;
  itemKey: ItemKey;
}

/**
 * fanId → how much their vote counts.
 * - Album page: everyone under the matchKey, track buyers included. A comp's page takes only
 *   buyers of the whole comp: a track's buyers came for that one artist.
 * - Track page: the album's buyers and this track's (its rows, plus `listed`, the track page's
 *   supporters). Buyers of other tracks drop out. On a comp, album buyers count COMP_BUYER_WEIGHT.
 */
export function releaseBuyers(
  page: BuyerPage,
  rows: readonly BuyerRow[],
  listed: readonly number[],
): Map<number, number> {
  const { releaseKey, matchKey, compilation } = page;
  const weights = new Map<number, number>();
  const add = (fanId: number, weight: number) =>
    weights.set(fanId, Math.max(weight, weights.get(fanId) ?? 0));

  if (releaseKey === matchKey) {
    for (const row of rows) if (!compilation || row.itemKey === matchKey) add(row.fanId, 1);
    return weights;
  }
  const albumWeight = compilation ? COMP_BUYER_WEIGHT : 1;
  for (const row of rows) {
    if (row.itemKey === releaseKey) add(row.fanId, 1);
    else if (row.itemKey === matchKey) add(row.fanId, albumWeight);
  }
  for (const fanId of listed) add(fanId, 1);
  return weights;
}
