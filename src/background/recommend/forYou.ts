// Runs the For-you scorer: what your top crate mates own (or, for Fresh, what your lately crate mates
// bought recently), scored with pruning, diversified, then dressed for display.

import { keyFromNumber, keyToNumber, type ItemKey } from '../../bandcamp';
import {
  gatherForYou,
  getDisplayItems,
  getShownFields,
  getLatelyCrateMates,
  getOwnerCounts,
  getCrateMates,
  type DigheadDb,
  type ForYouData,
  type ItemFields,
  type MeRecord,
} from '../../db';
import { discountCompilations } from '../../scoring/compilations';
import { type Exclusions, exclusions } from '../../scoring/exclusions';
import { boostFollowed, maxFollowFactor } from '../../scoring/following';
import {
  bestCrateMateRank,
  couldRank,
  FOR_YOU_LIMIT,
  forYouPicks,
  rankForYou,
  scoreForYou,
  topCrateMates,
  crateMateOwnership,
  type ForYouScored,
  type CrateMate,
  type CrateMateOwned,
} from '../../scoring/forYou';
import { freshOwnership, type FreshOwned } from '../../scoring/fresh';
import { MONTH_MS } from '../../scoring/lately';
import { supporters } from '../../scoring/weights';
import type { ForYouMode, ForYouResult } from '../../shared/forYou';
import type { ListFilters } from '../../shared/listFilters';
import { createFilterGate, type FilterGate } from './filterGate';
import { loadFollowedReleases } from './followSignal';
import { listsInRankOrder, toRow } from './forYouRow';
import { loadHideScopes } from './hideScopes';
import { crateMatesBasis } from './crateMateRows';

/** Ranked before diversifying, so artists' moved-down extras leave room for others. */
const RANKED = FOR_YOU_LIMIT * 2;
/** Item records and owner counts are looked up this many candidates at a time. */
const CHUNK = 200;

/** Deep cuts has its own runner (`deepCuts.ts`). */
export type RankedForYouMode = Exclude<ForYouMode, 'deep'>;

export interface ForYouInput {
  mode: RankedForYouMode;
  topCrateMatesK: number;
  /** Fresh fades each crate mate's purchases with this half-life, as the lately score does. */
  latelyHalfLifeMonths: number;
  /** Releases from accounts you follow score a little higher (decisions §16). */
  followingBoost: boolean;
  /** Down-weight compilations among the picks (decisions §17). */
  ignoreCompilations: boolean;
  /** Leave out releases you've heard, before the list is cut to length (decisions §22). */
  hideHeard: boolean;
  now: number;
  /** Narrow the picks (decisions §25), with the place "Near me" matches against. */
  filters?: ListFilters;
  homePlace?: string;
}

export async function computeForYou(
  db: DigheadDb,
  me: MeRecord | undefined,
  input: ForYouInput,
): Promise<ForYouResult> {
  const basis = crateMatesBasis(me);
  if (!me) return { basis, rows: [], crateMatesUsed: 0 };

  const gate = createFilterGate(db, input.filters, input.homePlace ?? '');
  const crateMates = topCrateMates(await boardFor(db, input.mode), input.topCrateMatesK);
  const data = await gatherForYou(
    db,
    crateMates.map((crateMate) => crateMate.fanId),
    me.fanId,
  );
  const excluded = exclusions(data.mine, data.hidden, {
    heard: input.hideHeard ? data.heard : undefined,
  });
  const candidates = candidatesFor(input, crateMates, data, excluded.ids);
  const lastBought = new Map<number, number>();
  for (const c of candidates) if ('lastBoughtAt' in c) lastBought.set(c.id, c.lastBoughtAt);

  const followed = await loadFollowedReleases(db, input.followingBoost);
  const { ranked, items } = await scoreTop(db, candidates, followed, {
    ignoreCompilations: input.ignoreCompilations,
    excluded,
    gate,
  });
  const supportersOf = new Map(ranked.map((scored) => [scored.id, scored.supporters]));
  const lists = listsInRankOrder(crateMates, data);
  const artists = new Map<number, string>();
  for (const scored of ranked) {
    const item = items.get(keyFromNumber(scored.id));
    if (item) artists.set(scored.id, item.artist);
  }
  const picks = forYouPicks(ranked, artists, FOR_YOU_LIMIT);
  // Only the rows shown need URLs, so only they look up their bands (decisions §19).
  const display = await getDisplayItems(
    db,
    picks.map((pick) => pick.matchKey),
  );
  const scopes = await loadHideScopes(db, display);
  const rows = picks.flatMap((pick) => {
    const item = display.get(pick.matchKey);
    const hide = scopes.get(pick.matchKey);
    if (!item || !hide) return [];
    const id = keyToNumber(pick.matchKey);
    return [
      toRow(pick.matchKey, item, {
        crateMates: pick.crateMates,
        supporters: supportersOf.get(id) ?? pick.crateMates,
        bestCrateMateRank: bestCrateMateRank(id, lists),
        lastBoughtAt: lastBought.get(id) ?? null,
        followed: followed.get(id) ?? null,
        heard: data.heard.has(pick.matchKey),
        hide,
      }),
    ];
  });
  return {
    basis,
    rows,
    crateMatesUsed: data.crateMateLists.length,
    ...(gate && { filtered: gate.applied() }),
  };
}

/** The board a mode draws on, as crate mates scored by it. Lately crate mates without a lately score are out. */
async function boardFor(db: DigheadDb, mode: RankedForYouMode): Promise<CrateMate[]> {
  if (mode === 'all') return getCrateMates(db);
  return (await getLatelyCrateMates(db)).flatMap((crateMate) =>
    crateMate.lately === null ? [] : [{ fanId: crateMate.fanId, score: crateMate.lately }],
  );
}

function candidatesFor(
  input: ForYouInput,
  crateMates: readonly CrateMate[],
  data: ForYouData,
  excluded: ReadonlySet<number>,
): readonly (CrateMateOwned | FreshOwned)[] {
  const scoreOf = new Map(crateMates.map((crateMate) => [crateMate.fanId, crateMate.score]));
  if (input.mode === 'all') {
    return crateMateOwnership(
      data.crateMateLists.map((list) => ({
        score: scoreOf.get(list.fanId) ?? 0,
        matches: list.matchIds,
      })),
      excluded,
    );
  }
  return freshOwnership(
    data.crateMateLists.map((list) => ({
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
 * Scores candidates in falling crateMateScore order, a chunk at a time, and stops once none left
 * can reach the ranked list. Candidates with no item record can't be shown, so they don't
 * take a place, and neither do those from a hidden artist or label (§22). Ceilings allow for the
 * follow boost, so a followed release is never cut early. Compilations are down-weighted by
 * their shown record's flag (§17). Candidates the filter turns down are dropped before they're
 * looked up or scored, so they take no place (§25).
 */
async function scoreTop(
  db: DigheadDb,
  candidates: readonly CrateMateOwned[],
  followed: ReadonlyMap<number, string>,
  {
    ignoreCompilations,
    excluded,
    gate,
  }: { ignoreCompilations: boolean; excluded: Exclusions; gate: FilterGate | null },
): Promise<{ ranked: ForYouScored[]; items: Map<ItemKey, ItemFields> }> {
  let ranked: ForYouScored[] = [];
  const items = new Map<ItemKey, ItemFields>();
  const factor = maxFollowFactor(followed);
  for (let start = 0; start < candidates.length; start += CHUNK) {
    const first = candidates[start];
    if (!first || !couldRank(ranked, RANKED, first.crateMateScore * factor)) break;
    if (gate?.exhausted) {
      gate.stoppedAtLimit();
      break;
    }
    const couldRankNow = candidates
      .slice(start, start + CHUNK)
      .filter((c) => couldRank(ranked, RANKED, c.crateMateScore * factor));
    // The gate reads the records it judges, so they aren't read again below.
    const passing = gate && (await gate.passing(couldRankNow.map((c) => keyFromNumber(c.id))));
    const chunk = passing
      ? couldRankNow.filter((c) => passing.has(keyFromNumber(c.id)))
      : couldRankNow;
    const [display, owners] = await Promise.all([
      passing ??
        getShownFields(
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
      if (!item || !excluded.allows(item)) return [];
      items.set(keyFromNumber(c.id), item);
      if (ignoreCompilations && item.compilation) compilations.add(c.id);
      return [scoreForYou(c, supporters([item.supporterCount], owners.get(c.id) ?? c.crateMates))];
    });
    const adjusted = boostFollowed(discountCompilations(scored, compilations), followed);
    ranked = rankForYou([...ranked, ...adjusted], RANKED);
  }
  return { ranked, items };
}
