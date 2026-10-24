// Dresses a For-you pick (any mode) for display.

import { artUrl, type ItemKey } from '../../bandcamp';
import type { ForYouData, ItemRecord } from '../../db';
import type { CrateMate } from '../../scoring/forYou';
import type { ForYouRow } from '../../shared/forYou';

export type PickFacts = Pick<
  ForYouRow,
  'crateMates' | 'supporters' | 'bestCrateMateRank' | 'lastBoughtAt' | 'followed' | 'heard' | 'hide'
>;

export function toRow(matchKey: ItemKey, item: ItemRecord, facts: PickFacts): ForYouRow {
  return {
    matchKey,
    title: item.title,
    artist: item.artist,
    label: item.label,
    url: item.url,
    coverUrl: item.artId === null ? null : artUrl(item.artId),
    ...facts,
  };
}

/** The crate mates' match lists in board order, with a gap for crate mates never scanned, for bestCrateMateRank. */
export function listsInRankOrder(
  crateMates: readonly CrateMate[],
  data: ForYouData,
): (Float64Array | undefined)[] {
  const byFan = new Map(data.crateMateLists.map((list) => [list.fanId, list.matchIds]));
  return crateMates.map((crateMate) => byFan.get(crateMate.fanId));
}
