// Recomputes the crate-mates leaderboards, all-time and lately: your basis once, then every read
// fan in pages, with a yield between pages so the worker never blocks for long.

import {
  gatherCrateMateBasis,
  readCrateMateCandidates,
  replaceCrateMates,
  type DigheadDb,
  type CrateMateRecord,
} from '../../db';
import { moment, MONTH_MS, TREND_LOOKBACK_MS } from '../../scoring/lately';
import {
  compareLately,
  compareCrateMates,
  isLatelyCrateMate,
  scoreCrateMate,
  type CrateMate,
  type CrateMateInput,
} from '../../scoring/crateMates';
import { supporters, weight } from '../../scoring/weights';
import type { Settings } from '../../shared/settings';

/** Each leaderboard keeps this many. For you only reads the top `topCrateMatesK`. */
export const CRATE_MATES_KEPT = 200;
/** Fans scored per page between yields. */
const PAGE = 500;

export interface CrateMatesDeps {
  db: DigheadDb;
  settings: Settings;
  now: number;
  /** Lets other work run between pages. */
  yieldNow: () => Promise<void>;
}

/** Recomputes and stores both leaderboards. Returns the all-time one. */
export async function computeCrateMates(
  deps: CrateMatesDeps,
  meFanId: number,
): Promise<CrateMateRecord[]> {
  const { db, settings, now } = deps;
  const basis = await gatherCrateMateBasis(db, meFanId);
  const weights = new Map<number, number>();
  for (const [id, counts] of basis.counts) {
    weights.set(id, weight(supporters(counts.bandcampCounts, counts.knownOwners)));
  }
  const halfLifeMs = settings.latelyHalfLifeMonths * MONTH_MS;
  const input: CrateMateInput = {
    mine: basis.mine,
    weights,
    labelOf: basis.labelOf,
    catalogSize: basis.catalogSize,
    minCollectionSize: settings.minCollectionSize,
    maxCollectionSize: settings.maxCollectionSize,
    labelClusterDownweight: settings.labelClusterDownweight,
    compilations: settings.ignoreCompilations ? basis.compilations : new Set(),
    lately: {
      halfLifeMs,
      minPurchases: settings.latelyMinPurchases,
      now: moment(now, basis.mine.matchTimes, halfLifeMs),
      yearAgo: moment(now - TREND_LOOKBACK_MS, basis.mine.matchTimes, halfLifeMs),
    },
  };

  let best: CrateMate[] = [];
  let bestLately: CrateMate[] = [];
  for (let after: number | null = -Infinity; after !== null && basis.mine.matchIds.length > 0; ) {
    const page = await readCrateMateCandidates(db, after, PAGE, meFanId);
    for (const candidate of page.candidates) {
      const crateMate = scoreCrateMate(candidate, input);
      if (!crateMate) continue;
      best.push(crateMate);
      if (isLatelyCrateMate(crateMate)) bestLately.push(crateMate);
    }
    best = keepBest(best, compareCrateMates);
    bestLately = keepBest(bestLately, compareLately);
    after = page.next;
    await deps.yieldNow();
  }

  const record = (crateMate: CrateMate): CrateMateRecord => ({ ...crateMate, computedAt: now });
  const records = best.sort(compareCrateMates).slice(0, CRATE_MATES_KEPT).map(record);
  const latelyRecords = bestLately.sort(compareLately).slice(0, CRATE_MATES_KEPT).map(record);
  await replaceCrateMates(db, records, latelyRecords);
  return records;
}

/** Trims a growing list back to the leaders once it's twice the size kept. */
function keepBest(
  crateMates: CrateMate[],
  compare: (a: CrateMate, b: CrateMate) => number,
): CrateMate[] {
  return crateMates.length > CRATE_MATES_KEPT * 2
    ? crateMates.sort(compare).slice(0, CRATE_MATES_KEPT)
    : crateMates;
}
