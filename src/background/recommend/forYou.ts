// Runs the For-you scorer: what your top twins own, scored with pruning, diversified, then
// dressed for display.

import {
  artUrl,
  embeddedPlayerUrl,
  keyFromNumber,
  keyToNumber,
  type ItemKey,
} from '../../bandcamp';
import {
  gatherForYou,
  getDisplayItems,
  getOwnerCounts,
  getTwins,
  type DigheadDb,
  type ItemRecord,
  type MeRecord,
} from '../../db';
import { exclusions } from '../../scoring/exclusions';
import {
  couldRank,
  FOR_YOU_LIMIT,
  forYouPicks,
  rankForYou,
  scoreForYou,
  topTwins,
  twinOwnership,
  type ForYouScored,
  type TwinOwned,
} from '../../scoring/forYou';
import { supporters } from '../../scoring/weights';
import type { ForYouResult, ForYouRow } from '../../shared/forYou';
import { twinsBasis } from './twinRows';

/** Ranked before diversifying, so artists' moved-down extras leave room for others. */
const RANKED = FOR_YOU_LIMIT * 2;
/** Item records and owner counts are looked up this many candidates at a time. */
const CHUNK = 200;

export async function computeForYou(
  db: DigheadDb,
  me: MeRecord | undefined,
  topTwinsK: number,
): Promise<ForYouResult> {
  const basis = twinsBasis(me);
  if (!me) return { basis, rows: [], twinsUsed: 0 };

  const twins = topTwins(await getTwins(db), topTwinsK);
  const data = await gatherForYou(
    db,
    twins.map((twin) => twin.fanId),
    me.fanId,
  );
  const scoreOf = new Map(twins.map((twin) => [twin.fanId, twin.score]));
  const mine = exclusions(data.mine, data.hidden);
  const candidates = twinOwnership(
    data.twinLists.map((list) => ({ score: scoreOf.get(list.fanId) ?? 0, matches: list.matchIds })),
    mine.excluded,
  );

  const { ranked, items } = await scoreTop(db, candidates);
  const artists = new Map<number, string>();
  for (const scored of ranked) {
    const item = items.get(keyFromNumber(scored.id));
    if (item) artists.set(scored.id, item.artist);
  }
  const rows = forYouPicks(ranked, artists, FOR_YOU_LIMIT).flatMap((pick) => {
    const item = items.get(pick.matchKey);
    return item ? [toRow(pick.matchKey, item, pick.twins, mine.ownedTracks)] : [];
  });
  return { basis, rows, twinsUsed: data.twinLists.length };
}

/**
 * Scores candidates in falling twinScore order, a chunk at a time, and stops once none left
 * can reach the ranked list. Candidates with no item record can't be shown, so they don't
 * take a place.
 */
async function scoreTop(
  db: DigheadDb,
  candidates: readonly TwinOwned[],
): Promise<{ ranked: ForYouScored[]; items: Map<ItemKey, ItemRecord> }> {
  let ranked: ForYouScored[] = [];
  const items = new Map<ItemKey, ItemRecord>();
  for (let start = 0; start < candidates.length; start += CHUNK) {
    const first = candidates[start];
    if (!first || !couldRank(ranked, RANKED, first.twinScore)) break;
    const chunk = candidates
      .slice(start, start + CHUNK)
      .filter((c) => couldRank(ranked, RANKED, c.twinScore));
    const [display, owners] = await Promise.all([
      getDisplayItems(
        db,
        chunk.map((c) => keyFromNumber(c.id)),
      ),
      getOwnerCounts(
        db,
        chunk.map((c) => c.id),
      ),
    ]);
    const scored = chunk.flatMap((c) => {
      const item = display.get(keyFromNumber(c.id));
      if (!item) return [];
      items.set(keyFromNumber(c.id), item);
      return [scoreForYou(c, supporters([item.supporterCount], owners.get(c.id) ?? c.twins))];
    });
    ranked = rankForYou([...ranked, ...scored], RANKED);
  }
  return { ranked, items };
}

function toRow(
  matchKey: ItemKey,
  item: ItemRecord,
  twins: number,
  ownedTracks: ReadonlyMap<number, number>,
): ForYouRow {
  return {
    matchKey,
    title: item.title,
    artist: item.artist,
    label: item.label,
    url: item.url,
    coverUrl: item.artId === null ? null : artUrl(item.artId),
    previewUrl: embeddedPlayerUrl(matchKey),
    twins,
    ownedTracks: ownedTracks.get(keyToNumber(matchKey)) ?? 0,
  };
}
