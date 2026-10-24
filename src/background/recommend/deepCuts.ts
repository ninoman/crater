// Runs Deep cuts (decisions §18): what few own but your top DEEP_CUT_CRATE_MATES_K crate mates do, looked up in
// ceiling order with pruning, diversified, then dressed as For-you rows.

import { keyFromNumber, type ItemKey } from '../../bandcamp';
import {
  gatherForYou,
  getDisplayItems,
  getShownFields,
  getCrateMates,
  type DigheadDb,
  type ItemFields,
  type MeRecord,
} from '../../db';
import {
  couldRankDeepCut,
  deepCutCandidates,
  deepCutReason,
  extendDeepCuts,
  type DeepCutCandidate,
  type DeepCutOptions,
  type DeepCutScored,
} from '../../scoring/deepCuts';
import { exclusions } from '../../scoring/exclusions';
import { diversify, FOR_YOU_LIMIT, topCrateMates, crateMateOwnership } from '../../scoring/forYou';
import { DEEP_CUT_CRATE_MATES_K } from '../../scoring/weights';
import type { ForYouResult } from '../../shared/forYou';
import type { ListFilters } from '../../shared/listFilters';
import { createFilterGate, type FilterGate } from './filterGate';
import { listsInRankOrder, toRow } from './forYouRow';
import { crateMatesBasis } from './crateMateRows';

/** Ranked before diversifying, so artists' moved-down extras leave room for others. */
const RANKED = FOR_YOU_LIMIT * 2;
/** Item records are looked up this many candidates at a time. */
const CHUNK = 200;

export interface DeepCutsInput {
  /** settings.deepCutMaxSupporters. */
  maxSupporters: number;
  /** Down-weight compilations among the picks (decisions §17). */
  ignoreCompilations: boolean;
  /** Narrow the picks (decisions §22), with the place "Near me" matches against. */
  filters?: ListFilters;
  homePlace?: string;
}

export async function computeDeepCuts(
  db: DigheadDb,
  me: MeRecord | undefined,
  input: DeepCutsInput,
): Promise<ForYouResult> {
  const basis = crateMatesBasis(me);
  if (!me) return { basis, rows: [], crateMatesUsed: 0 };

  const gate = createFilterGate(db, input.filters, input.homePlace ?? '');
  const crateMates = topCrateMates(await getCrateMates(db), DEEP_CUT_CRATE_MATES_K);
  const data = await gatherForYou(
    db,
    crateMates.map((crateMate) => crateMate.fanId),
    me.fanId,
  );
  const scoreOf = new Map(crateMates.map((crateMate) => [crateMate.fanId, crateMate.score]));
  const owned = crateMateOwnership(
    data.crateMateLists.map((list) => ({
      score: scoreOf.get(list.fanId) ?? 0,
      matches: list.matchIds,
    })),
    exclusions(data.mine, data.hidden),
  );
  const options = { maxSupporters: input.maxSupporters, limit: RANKED };
  const { ranked, items } = await scoreTop(db, deepCutCandidates(owned), options, input, gate);

  const artists = new Map<number, string>();
  for (const scored of ranked) {
    const item = items.get(keyFromNumber(scored.id));
    if (item) artists.set(scored.id, item.artist);
  }
  const lists = listsInRankOrder(crateMates, data);
  const picks = diversify(ranked, artists).slice(0, FOR_YOU_LIMIT);
  // Only the rows shown need URLs, so only they look up their bands (decisions §19).
  const display = await getDisplayItems(
    db,
    picks.map((scored) => keyFromNumber(scored.id)),
  );
  const rows = picks.flatMap((scored) => {
    const matchKey = keyFromNumber(scored.id);
    const item = display.get(matchKey);
    if (!item) return [];
    return [
      toRow(matchKey, item, {
        ...deepCutReason(scored, lists),
        lastBoughtAt: null,
        followed: null,
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

/**
 * Looks up item records a chunk at a time, in falling ceiling order, and stops once no ceiling
 * left can reach the ranked list. Only candidates that could still rank are looked up, and those
 * the filter turns down are dropped first (decisions §22).
 */
async function scoreTop(
  db: DigheadDb,
  candidates: readonly DeepCutCandidate[],
  options: DeepCutOptions & { limit: number },
  input: DeepCutsInput,
  gate: FilterGate | null,
): Promise<{ ranked: DeepCutScored[]; items: Map<ItemKey, ItemFields> }> {
  let ranked: DeepCutScored[] = [];
  const items = new Map<ItemKey, ItemFields>();
  for (let start = 0; start < candidates.length; start += CHUNK) {
    if (gate?.exhausted) {
      gate.stoppedAtLimit();
      break;
    }
    const couldRankNow = candidates
      .slice(start, start + CHUNK)
      .filter((c) => couldRankDeepCut(ranked, options.limit, c.ceiling));
    if (couldRankNow.length === 0) break;
    // The gate reads the records it judges, so they aren't read again below.
    const passing = gate && (await gate.passing(couldRankNow.map((c) => keyFromNumber(c.id))));
    const chunk = passing
      ? couldRankNow.filter((c) => passing.has(keyFromNumber(c.id)))
      : couldRankNow;
    if (chunk.length === 0) continue;
    const display =
      passing ??
      (await getShownFields(
        db,
        chunk.map((c) => keyFromNumber(c.id)),
      ));
    for (const [key, item] of display) items.set(key, item);
    const step = extendDeepCuts(
      ranked,
      chunk,
      (id) => {
        const item = display.get(keyFromNumber(id));
        return (
          item && {
            supporterCount: item.supporterCount,
            compilation: input.ignoreCompilations && item.compilation,
          }
        );
      },
      options,
    );
    ranked = step.top;
    if (step.done) break;
  }
  return { ranked, items };
}
