// Runs Deep cuts (decisions §18): what few own but your top DEEP_CUT_TWINS_K twins do, looked up in
// ceiling order with pruning, diversified, then dressed as For-you rows.

import { keyFromNumber, type ItemKey } from '../../bandcamp';
import {
  gatherForYou,
  getDisplayItems,
  getTwins,
  type DigheadDb,
  type ItemRecord,
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
import { diversify, FOR_YOU_LIMIT, topTwins, twinOwnership } from '../../scoring/forYou';
import { DEEP_CUT_TWINS_K } from '../../scoring/weights';
import type { ForYouResult } from '../../shared/forYou';
import { listsInRankOrder, toRow } from './forYouRow';
import { twinsBasis } from './twinRows';

/** Ranked before diversifying, so artists' moved-down extras leave room for others. */
const RANKED = FOR_YOU_LIMIT * 2;
/** Item records are looked up this many candidates at a time. */
const CHUNK = 200;

export interface DeepCutsInput {
  /** settings.deepCutMaxSupporters. */
  maxSupporters: number;
  /** Down-weight compilations among the picks (decisions §17). */
  ignoreCompilations: boolean;
}

export async function computeDeepCuts(
  db: DigheadDb,
  me: MeRecord | undefined,
  input: DeepCutsInput,
): Promise<ForYouResult> {
  const basis = twinsBasis(me);
  if (!me) return { basis, rows: [], twinsUsed: 0 };

  const twins = topTwins(await getTwins(db), DEEP_CUT_TWINS_K);
  const data = await gatherForYou(
    db,
    twins.map((twin) => twin.fanId),
    me.fanId,
  );
  const scoreOf = new Map(twins.map((twin) => [twin.fanId, twin.score]));
  const owned = twinOwnership(
    data.twinLists.map((list) => ({ score: scoreOf.get(list.fanId) ?? 0, matches: list.matchIds })),
    exclusions(data.mine, data.hidden),
  );
  const options = { maxSupporters: input.maxSupporters, limit: RANKED };
  const { ranked, items } = await scoreTop(db, deepCutCandidates(owned), options, input);

  const artists = new Map<number, string>();
  for (const scored of ranked) {
    const item = items.get(keyFromNumber(scored.id));
    if (item) artists.set(scored.id, item.artist);
  }
  const lists = listsInRankOrder(twins, data);
  const rows = diversify(ranked, artists)
    .slice(0, FOR_YOU_LIMIT)
    .flatMap((scored) => {
      const matchKey = keyFromNumber(scored.id);
      const item = items.get(matchKey);
      if (!item) return [];
      return [
        toRow(matchKey, item, {
          ...deepCutReason(scored, lists),
          lastBoughtAt: null,
          followed: null,
        }),
      ];
    });
  return { basis, rows, twinsUsed: data.twinLists.length };
}

/**
 * Looks up item records a chunk at a time, in falling ceiling order, and stops once no ceiling
 * left can reach the ranked list. Only candidates that could still rank are looked up.
 */
async function scoreTop(
  db: DigheadDb,
  candidates: readonly DeepCutCandidate[],
  options: DeepCutOptions & { limit: number },
  input: DeepCutsInput,
): Promise<{ ranked: DeepCutScored[]; items: Map<ItemKey, ItemRecord> }> {
  let ranked: DeepCutScored[] = [];
  const items = new Map<ItemKey, ItemRecord>();
  for (let start = 0; start < candidates.length; start += CHUNK) {
    const chunk = candidates
      .slice(start, start + CHUNK)
      .filter((c) => couldRankDeepCut(ranked, options.limit, c.ceiling));
    if (chunk.length === 0) break;
    const display = await getDisplayItems(
      db,
      chunk.map((c) => keyFromNumber(c.id)),
    );
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
