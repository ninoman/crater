// Runs the For-you scorer: what your top twins own (or, for Fresh, what your lately twins
// bought recently), scored with pruning, diversified, then dressed for display.

import { keyFromNumber, keyToNumber, type ItemKey } from '../../bandcamp';
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
import { discountCompilations } from '../../scoring/compilations';
import { exclusions } from '../../scoring/exclusions';
import { boostFollowed, maxFollowFactor } from '../../scoring/following';
import {
  bestTwinRank,
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
import type { ForYouMode, ForYouResult } from '../../shared/forYou';
import { loadFollowedReleases } from './followSignal';
import { listsInRankOrder, toRow } from './forYouRow';
import { twinsBasis } from './twinRows';

/** Ranked before diversifying, so artists' moved-down extras leave room for others. */
const RANKED = FOR_YOU_LIMIT * 2;
/** Item records and owner counts are looked up this many candidates at a time. */
const CHUNK = 200;

/** Deep cuts has its own runner (`deepCuts.ts`). */
export type RankedForYouMode = Exclude<ForYouMode, 'deep'>;

export interface ForYouInput {
  mode: RankedForYouMode;
  topTwinsK: number;
  /** Fresh fades each twin's purchases with this half-life, as the lately score does. */
  latelyHalfLifeMonths: number;
  /** Releases from accounts you follow score a little higher (decisions §16). */
  followingBoost: boolean;
  /** Down-weight compilations among the picks (decisions §17). */
  ignoreCompilations: boolean;
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

  const followed = await loadFollowedReleases(db, input.followingBoost);
  const { ranked, items } = await scoreTop(db, candidates, followed, input.ignoreCompilations);
  const supportersOf = new Map(ranked.map((scored) => [scored.id, scored.supporters]));
  const lists = listsInRankOrder(twins, data);
  const artists = new Map<number, string>();
  for (const scored of ranked) {
    const item = items.get(keyFromNumber(scored.id));
    if (item) artists.set(scored.id, item.artist);
  }
  const rows = forYouPicks(ranked, artists, FOR_YOU_LIMIT).flatMap((pick) => {
    const item = items.get(pick.matchKey);
    if (!item) return [];
    const id = keyToNumber(pick.matchKey);
    return [
      toRow(pick.matchKey, item, {
        twins: pick.twins,
        supporters: supportersOf.get(id) ?? pick.twins,
        bestTwinRank: bestTwinRank(id, lists),
        lastBoughtAt: lastBought.get(id) ?? null,
        followed: followed.get(id) ?? null,
      }),
    ];
  });
  return { basis, rows, twinsUsed: data.twinLists.length };
}

/** The board a mode draws on, as twins scored by it. Lately twins without a lately score are out. */
async function boardFor(db: DigheadDb, mode: RankedForYouMode): Promise<Twin[]> {
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
 * take a place. Ceilings allow for the follow boost, so a followed release is never cut early.
 * Compilations are down-weighted by their shown record's flag (§17).
 */
async function scoreTop(
  db: DigheadDb,
  candidates: readonly TwinOwned[],
  followed: ReadonlyMap<number, string>,
  ignoreCompilations: boolean,
): Promise<{ ranked: ForYouScored[]; items: Map<ItemKey, ItemRecord> }> {
  let ranked: ForYouScored[] = [];
  const items = new Map<ItemKey, ItemRecord>();
  const factor = maxFollowFactor(followed);
  for (let start = 0; start < candidates.length; start += CHUNK) {
    const first = candidates[start];
    if (!first || !couldRank(ranked, RANKED, first.twinScore * factor)) break;
    const chunk = candidates
      .slice(start, start + CHUNK)
      .filter((c) => couldRank(ranked, RANKED, c.twinScore * factor));
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
    const compilations = new Set<number>();
    const scored = chunk.flatMap((c) => {
      const item = display.get(keyFromNumber(c.id));
      if (!item) return [];
      items.set(keyFromNumber(c.id), item);
      if (ignoreCompilations && item.compilation) compilations.add(c.id);
      return [scoreForYou(c, supporters([item.supporterCount], owners.get(c.id) ?? c.twins))];
    });
    const adjusted = boostFollowed(discountCompilations(scored, compilations), followed);
    ranked = rankForYou([...ranked, ...adjusted], RANKED);
  }
  return { ranked, items };
}
