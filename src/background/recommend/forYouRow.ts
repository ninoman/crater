// Dresses a For-you pick (any mode) for display.

import { artUrl, type ItemKey } from '../../bandcamp';
import type { ForYouData, ItemRecord } from '../../db';
import type { Twin } from '../../scoring/forYou';
import type { ForYouRow } from '../../shared/forYou';

export type PickFacts = Pick<
  ForYouRow,
  'twins' | 'supporters' | 'bestTwinRank' | 'lastBoughtAt' | 'followed'
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

/** The twins' match lists in board order, with a gap for twins never scanned, for bestTwinRank. */
export function listsInRankOrder(
  twins: readonly Twin[],
  data: ForYouData,
): (Float64Array | undefined)[] {
  const byFan = new Map(data.twinLists.map((list) => [list.fanId, list.matchIds]));
  return twins.map((twin) => byFan.get(twin.fanId));
}
