// The eval's I/O edge: loads a backup, then for each split holds releases out of the database,
// recomputes the twin board with the real worker code, and scores every method. Everything it
// returns is aggregate numbers.

import { keyFromNumber, keyToNumber, type ItemKey } from '../../src/bandcamp';
import { computeTwins } from '../../src/background/recommend/twins';
import {
  type DigheadDb,
  gatherForYou,
  getDisplayItems,
  getOwnerCounts,
  importDatabase,
  type OwnershipRecord,
  refreshFanMatches,
  removeOwnershipExcept,
  type SnapshotStore,
} from '../../src/db';
import { exclusions } from '../../src/scoring/exclusions';
import { topTwins, twinOwnership } from '../../src/scoring/forYou';
import { DEFAULT_SETTINGS } from '../../src/shared/settings';
import { aggregate } from './aggregate';
import { evaluateFold } from './evaluate';
import { buildMethods } from './methods';
import type { SplitResult } from './report';
import { datedShare, type Purchase, randomFolds, temporalHoldout } from './splits';
import type { Candidate, FoldRow, Popularity } from './types';

export const HOLDOUT_FRACTION = 0.2;
export const RANDOM_FOLDS = 5;
export const SEED = 1;
/** Below this share of dated purchases, "newest" is meaningless and the temporal split is skipped. */
const MIN_DATED_SHARE = 0.5;
const LOOKUP_CHUNK = 1000;

function memorySnapshot(): SnapshotStore {
  let saved: Blob | null = null;
  return {
    save: async (file) => {
      saved = file;
    },
    load: async () => saved ?? new Blob(),
    exists: async () => saved !== null,
    discard: async () => {
      saved = null;
    },
  };
}

/** Loads a full-database backup into an empty database, through the extension's own importer. */
export async function loadBackup(db: DigheadDb, file: Blob): Promise<void> {
  await importDatabase(db, file, memorySnapshot(), async () => undefined);
}

export interface EvalRun {
  splits: SplitResult[];
  notes: string[];
}

/** Every method's metrics on each split, folds aggregated. */
export async function runEval(
  db: DigheadDb,
  log: (message: string) => void = () => undefined,
): Promise<EvalRun> {
  const me = await db.me.get('self');
  if (!me) throw new Error('The backup has no signed-in fan (the "me" table is empty).');
  const saved = (await db.ownership.where('fanId').equals(me.fanId).toArray()).filter(
    (row) => row.source === 'collection',
  );
  const purchases = purchasesOf(saved);
  if (purchases.length < RANDOM_FOLDS * 2) {
    throw new Error(`Only ${purchases.length} releases in your collection: too few to hold out.`);
  }

  const notes: string[] = [];
  const plans: { name: string; folds: number[][] }[] = [];
  if (datedShare(purchases) >= MIN_DATED_SHARE) {
    plans.push({
      name: 'Temporal (newest 20%)',
      folds: [temporalHoldout(purchases, HOLDOUT_FRACTION)],
    });
  } else {
    notes.push('Temporal split skipped: most of your purchases have no date in this backup.');
  }
  plans.push({
    name: `Random (${RANDOM_FOLDS} folds)`,
    folds: randomFolds(
      purchases.map((p) => p.id),
      RANDOM_FOLDS,
      SEED,
    ),
  });

  const methods = buildMethods();
  const twinKs = [...new Set(methods.map((m) => m.twinsK))];
  const popularity = new Map<number, Popularity>();
  const lookup = (id: number): Popularity => popularity.get(id) ?? { supporters: null, owners: 0 };
  const splits: SplitResult[] = [];
  for (const plan of plans) {
    const foldRows: FoldRow[][] = [];
    for (const [i, heldOut] of plan.folds.entries()) {
      log(`${plan.name}: fold ${i + 1}/${plan.folds.length} (${heldOut.length} held out)`);
      const rows = await withHoldout(db, me.fanId, saved, new Set(heldOut), async () => {
        const byK = await candidatesByK(db, me.fanId, twinKs);
        const ids = [...byK.values()].flatMap((list) => list.map((c) => c.id)).concat(heldOut);
        await resolvePopularity(db, popularity, ids);
        return evaluateFold(methods, withPopularity(byK, lookup), new Set(heldOut), lookup);
      });
      foldRows.push(rows);
    }
    splits.push({
      name: plan.name,
      folds: plan.folds.length,
      heldOut: plan.folds.map((fold) => fold.length),
      rows: aggregate(foldRows),
    });
  }
  return { splits, notes };
}

function withPopularity(
  byK: ReadonlyMap<number, Candidate[]>,
  lookup: (id: number) => Popularity,
): Map<number, Candidate[]> {
  return new Map([...byK].map(([k, list]) => [k, list.map((c) => ({ ...c, ...lookup(c.id) }))]));
}

/** Your collection as one purchase per match id, dated by its newest row. */
function purchasesOf(rows: readonly OwnershipRecord[]): Purchase[] {
  const newest = new Map<number, number | null>();
  for (const row of rows) {
    const id = keyToNumber(row.matchKey);
    const known = newest.get(id) ?? null;
    newest.set(id, row.addedAt === null ? known : Math.max(known ?? 0, row.addedAt));
  }
  return [...newest].map(([id, at]) => ({ id, at }));
}

/** Removes the held-out releases from your lists, runs `body`, and puts them back. */
async function withHoldout<T>(
  db: DigheadDb,
  fanId: number,
  saved: readonly OwnershipRecord[],
  heldOut: ReadonlySet<number>,
  body: () => Promise<T>,
): Promise<T> {
  const keep = new Set<ItemKey>(
    saved.filter((row) => !heldOut.has(keyToNumber(row.matchKey))).map((row) => row.itemKey),
  );
  await removeOwnershipExcept(db, fanId, 'collection', keep);
  try {
    return await body();
  } finally {
    await db.ownership.bulkPut([...saved]);
    await refreshFanMatches(db, [fanId]);
  }
}

/**
 * Recomputes the twin board from what's left of your collection (the real worker code), then
 * builds each K's candidates as For you does: the top-K twins' lists minus your exclusions.
 */
async function candidatesByK(
  db: DigheadDb,
  fanId: number,
  twinKs: readonly number[],
): Promise<Map<number, Candidate[]>> {
  const board = await computeTwins(
    { db, settings: DEFAULT_SETTINGS, now: Date.now(), yieldNow: async () => undefined },
    fanId,
  );
  const result = new Map<number, Candidate[]>();
  for (const k of twinKs) {
    const twins = topTwins(board, k);
    const data = await gatherForYou(
      db,
      twins.map((t) => t.fanId),
      fanId,
    );
    const scoreOf = new Map(twins.map((t) => [t.fanId, t.score]));
    const owned = twinOwnership(
      data.twinLists.map((list) => ({
        score: scoreOf.get(list.fanId) ?? 0,
        matches: list.matchIds,
      })),
      exclusions(data.mine, data.hidden),
    );
    result.set(
      k,
      owned.map((o) => ({ ...o, supporters: null, owners: o.twins })),
    );
  }
  return result;
}

/** Fills in Bandcamp's count and the local owners for ids not looked up yet. */
async function resolvePopularity(
  db: DigheadDb,
  into: Map<number, Popularity>,
  ids: readonly number[],
): Promise<void> {
  const todo = [...new Set(ids)].filter((id) => !into.has(id));
  for (let start = 0; start < todo.length; start += LOOKUP_CHUNK) {
    const chunk = todo.slice(start, start + LOOKUP_CHUNK);
    const [items, owners] = await Promise.all([
      getDisplayItems(db, chunk.map(keyFromNumber)),
      getOwnerCounts(db, chunk),
    ]);
    for (const id of chunk) {
      into.set(id, {
        supporters: items.get(keyFromNumber(id))?.supporterCount ?? null,
        owners: owners.get(id) ?? 0,
      });
    }
  }
}
