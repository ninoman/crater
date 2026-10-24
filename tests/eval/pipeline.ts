// The eval's I/O edge: loads a backup, then for each split holds releases out of the database,
// recomputes the crate mate board with the real worker code, and scores every method. Everything it
// returns is aggregate numbers.

import { peakImportFile } from 'dexie-export-import';
import { keyFromNumber, keyToNumber } from '../../src/bandcamp';
import { computeCrateMates } from '../../src/background/recommend/crateMates';
import {
  type DigheadDb,
  fanRows,
  gatherForYou,
  getShownFields,
  getOwnerCounts,
  importDatabase,
  type OwnershipRecord,
  putItems,
  readBackup,
  readItem,
  refreshFanMatches,
  replaceAll,
  type SnapshotStore,
} from '../../src/db';
import { flagCompilation } from '../../src/db/schema';
import { exclusions } from '../../src/scoring/exclusions';
import { topCrateMates, crateMateOwnership } from '../../src/scoring/forYou';
import { parseBackupMeta } from '../../src/shared/backupFile';
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
/** Fold fans count down from here: far below any real Bandcamp fan id. */
const HOLDOUT_FAN_ID = -1_000_000_000;
/**
 * From v7 on, the migrations left can skip the importer: queue ranks (v8) don't matter here,
 * and item rows (v11 flags, v12 shape) are rewritten below. Ownership rows still saying
 * 'collection' (v12 drops it) read the same.
 */
const MIN_FAST_VERSION = 7;

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

/**
 * Loads a full-database backup into an empty database. Small backups go through the extension's
 * own importer. Large ones skip its in-place migrations: fake-indexeddb scans every index entry
 * on each overwrite, so `modify` over 10⁵ items never finishes. They are rewritten into an
 * emptied table instead.
 */
export async function loadBackup(db: DigheadDb, backup: Blob): Promise<void> {
  const file = await readBackup(backup);
  // replaceAll first: it installs the FileReader that peakImportFile needs in Node.
  await replaceAll(db, file);
  const meta = parseBackupMeta(await peakImportFile(file));
  if (meta.data.databaseVersion < MIN_FAST_VERSION) {
    await importDatabase(db, file, memorySnapshot(), async () => undefined);
    return;
  }
  if (meta.data.databaseVersion >= 12) return;
  const rows = await db.items.toArray();
  for (const row of rows) flagCompilation(row);
  await db.items.clear();
  await putItems(
    db,
    rows.map((row) => readItem(row, undefined)),
  );
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
  const mine = await fanRows(db, me.fanId);
  const saved = mine.filter((row) => row.source === 'collection');
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
  const crateMateKs = [...new Set(methods.map((m) => m.crateMatesK))];
  const popularity = new Map<number, Popularity>();
  const lookup = (id: number): Popularity => popularity.get(id) ?? { supporters: null, owners: 0 };
  const splits: SplitResult[] = [];
  // From here on you're a fresh fan id per fold, so the real id must not count as a scanned fan.
  await dropFanMatches(db, me.fanId);
  let foldFan = HOLDOUT_FAN_ID;
  for (const plan of plans) {
    const foldRows: FoldRow[][] = [];
    for (const [i, heldOut] of plan.folds.entries()) {
      log(`${plan.name}: fold ${i + 1}/${plan.folds.length} (${heldOut.length} held out)`);
      foldFan -= 1;
      const fanId = foldFan;
      const rows = await withHoldout(db, fanId, mine, new Set(heldOut), async () => {
        const byK = await candidatesByK(db, fanId, crateMateKs);
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

/**
 * Writes your lists minus the held-out releases under `fanId`, runs `body` as that fan, then
 * takes the fan out of the match index. Deleting ownership rows instead would be far too slow:
 * fake-indexeddb scans every index entry on each delete. The rows left behind under old fold ids
 * are only read by fan, and no one asks for those fans again.
 */
async function withHoldout<T>(
  db: DigheadDb,
  fanId: number,
  mine: readonly OwnershipRecord[],
  heldOut: ReadonlySet<number>,
  body: () => Promise<T>,
): Promise<T> {
  const kept = mine.filter(
    (row) => row.source !== 'collection' || !heldOut.has(keyToNumber(row.matchKey)),
  );
  await db.ownership.bulkAdd(kept.map((row) => ({ ...row, fanId })));
  await refreshFanMatches(db, [fanId]);
  try {
    return await body();
  } finally {
    await dropFanMatches(db, fanId);
  }
}

/** Removes a fan from the match index and the owner counts, leaving its ownership rows. */
async function dropFanMatches(db: DigheadDb, fanId: number): Promise<void> {
  const lists = await db.fanMatches.get(fanId);
  if (!lists) return;
  const ids = [...lists.matchIds];
  const current = await db.matchOwners.bulkGet(ids);
  const put = current.flatMap((record) =>
    record && record.owners > 1 ? [{ ...record, owners: record.owners - 1 }] : [],
  );
  await db.matchOwners.bulkPut(put);
  await db.matchOwners.bulkDelete(ids.filter((_, i) => (current[i]?.owners ?? 0) <= 1));
  await db.fanMatches.delete(fanId);
}

/**
 * Recomputes the crate mate board from what's left of your collection (the real worker code), then
 * builds each K's candidates as For you does: the top-K crate mates' lists minus your exclusions.
 */
async function candidatesByK(
  db: DigheadDb,
  fanId: number,
  crateMateKs: readonly number[],
): Promise<Map<number, Candidate[]>> {
  const board = await computeCrateMates(
    { db, settings: DEFAULT_SETTINGS, now: Date.now(), yieldNow: async () => undefined },
    fanId,
  );
  const result = new Map<number, Candidate[]>();
  for (const k of crateMateKs) {
    const crateMates = topCrateMates(board, k);
    const data = await gatherForYou(
      db,
      crateMates.map((t) => t.fanId),
      fanId,
    );
    const scoreOf = new Map(crateMates.map((t) => [t.fanId, t.score]));
    const owned = crateMateOwnership(
      data.crateMateLists.map((list) => ({
        score: scoreOf.get(list.fanId) ?? 0,
        matches: list.matchIds,
      })),
      exclusions(data.mine, data.hidden).ids,
    );
    result.set(
      k,
      owned.map((o) => ({ ...o, supporters: null, owners: o.crateMates })),
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
      getShownFields(db, chunk.map(keyFromNumber)),
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
