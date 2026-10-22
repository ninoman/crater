// Runs the For-you scorer: what your top twins own (or, for Fresh, what your lately twins
// bought recently), scored with pruning, diversified, then dressed for display.

import { artUrl, keyFromNumber, keyToNumber, type ItemKey } from '../../bandcamp';
import {
  gatherForYou,
  getDisplayItems,
  getLatelyTwins,
  getOwnerCounts,
  getTwins,
  type DigheadDb,
  type ForYouData,
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
  type Twin,
  type TwinOwned,
} from '../../scoring/forYou';
import { freshOwnership, type FreshOwned } from '../../scoring/fresh';
import { MONTH_MS } from '../../scoring/lately';
import { supporters } from '../../scoring/weights';
import type { ForYouMode, ForYouResult, ForYouRow } from '../../shared/forYou';
import { twinsBasis } from './twinRows';

/** Ranked before diversifying, so artists' moved-down extras leave room for others. */
const RANKED = FOR_YOU_LIMIT * 2;
/** Item records and owner counts are looked up this many candidates at a time. */
const CHUNK = 200;

export interface ForYouInput {
  mode: ForYouMode;
  topTwinsK: number;
  /** Fresh fades each twin's purchases with this half-life, as the lately score does. */
  latelyHalfLifeMonths: number;
  now: number;
}

export async function computeForYou(
  db: DigheadDb,
  me: MeRecord | undefined,
  input: ForYouInput,
): Promise<ForYouResult> {
  const basis = twinsBasis(me);
  if (!me) return { basis, rows: [], twinsUsed: 0 };

  const twins = topTwins(await boardFor(db, input.mode), input.topTwinsK);
  const data = await gatherForYou(
    db,
    twins.map((twin) => twin.fanId),
    me.fanId,
  );
  const candidates = candidatesFor(input, twins, data);
  const lastBought = new Map<number, number>();
  for (const c of candidates) if ('lastBoughtAt' in c) lastBought.set(c.id, c.lastBoughtAt);

  const { ranked, items } = await scoreTop(db, candidates);
  const artists = new Map<number, string>();
  for (const scored of ranked) {
    const item = items.get(keyFromNumber(scored.id));
    if (item) artists.set(scored.id, item.artist);
  }
  const rows = forYouPicks(ranked, artists, FOR_YOU_LIMIT).flatMap((pick) => {
    const item = items.get(pick.matchKey);
    if (!item) return [];
    const boughtAt = lastBought.get(keyToNumber(pick.matchKey)) ?? null;
    return [toRow(pick.matchKey, item, pick.twins, boughtAt)];
  });
  return { basis, rows, twinsUsed: data.twinLists.length };
}

/** The board a mode draws on, as twins scored by it. Lately twins without a lately score are out. */
async function boardFor(db: DigheadDb, mode: ForYouMode): Promise<Twin[]> {
  if (mode === 'all') return getTwins(db);
  return (await getLatelyTwins(db)).flatMap((twin) =>
    twin.lately === null ? [] : [{ fanId: twin.fanId, score: twin.lately }],
  );
}

function candidatesFor(
  input: ForYouInput,
  twins: readonly Twin[],
  data: ForYouData,
): readonly (TwinOwned | FreshOwned)[] {
  const scoreOf = new Map(twins.map((twin) => [twin.fanId, twin.score]));
  const excluded = exclusions(data.mine, data.hidden);
  if (input.mode === 'all') {
    return twinOwnership(
      data.twinLists.map((list) => ({
        score: scoreOf.get(list.fanId) ?? 0,
        matches: list.matchIds,
      })),
      excluded,
    );
  }
  return freshOwnership(
    data.twinLists.map((list) => ({
      score: scoreOf.get(list.fanId) ?? 0,
      matches: list.matchIds,
      times: list.matchTimes,
    })),
    excluded,
    input.now,
    input.latelyHalfLifeMonths * MONTH_MS,
  );
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
  lastBoughtAt: number | null,
): ForYouRow {
  return {
    matchKey,
    title: item.title,
    artist: item.artist,
    label: item.label,
    url: item.url,
    coverUrl: item.artId === null ? null : artUrl(item.artId),
    twins,
    lastBoughtAt,
  };
}
