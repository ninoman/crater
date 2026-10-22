// Recomputes the taste-twins leaderboards, all-time and lately: your basis once, then every read
// fan in pages, with a yield between pages so the worker never blocks for long.

import {
  gatherTwinBasis,
  readTwinCandidates,
  replaceTwins,
  type DigheadDb,
  type TwinRecord,
} from '../../db';
import { moment, MONTH_MS, TREND_LOOKBACK_MS } from '../../scoring/lately';
import {
  compareLately,
  compareTwins,
  isLatelyTwin,
  scoreTwin,
  type Twin,
  type TwinInput,
} from '../../scoring/twins';
import { supporters, weight } from '../../scoring/weights';
import type { Settings } from '../../shared/settings';

/** Each leaderboard keeps this many. For you only reads the top `topTwinsK`. */
export const TWINS_KEPT = 200;
/** Fans scored per page between yields. */
const PAGE = 500;

export interface TwinsDeps {
  db: DigheadDb;
  settings: Settings;
  now: number;
  /** Lets other work run between pages. */
  yieldNow: () => Promise<void>;
}

/** Recomputes and stores both leaderboards. Returns the all-time one. */
export async function computeTwins(deps: TwinsDeps, meFanId: number): Promise<TwinRecord[]> {
  const { db, settings, now } = deps;
  const basis = await gatherTwinBasis(db, meFanId);
  const weights = new Map<number, number>();
  for (const [id, counts] of basis.counts) {
    weights.set(id, weight(supporters(counts.bandcampCounts, counts.knownOwners)));
  }
  const halfLifeMs = settings.latelyHalfLifeMonths * MONTH_MS;
  const input: TwinInput = {
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

  let best: Twin[] = [];
  let bestLately: Twin[] = [];
  for (let after: number | null = -Infinity; after !== null && basis.mine.matchIds.length > 0; ) {
    const page = await readTwinCandidates(db, after, PAGE, meFanId);
    for (const candidate of page.candidates) {
      const twin = scoreTwin(candidate, input);
      if (!twin) continue;
      best.push(twin);
      if (isLatelyTwin(twin)) bestLately.push(twin);
    }
    best = keepBest(best, compareTwins);
    bestLately = keepBest(bestLately, compareLately);
    after = page.next;
    await deps.yieldNow();
  }

  const record = (twin: Twin): TwinRecord => ({ ...twin, computedAt: now });
  const records = best.sort(compareTwins).slice(0, TWINS_KEPT).map(record);
  const latelyRecords = bestLately.sort(compareLately).slice(0, TWINS_KEPT).map(record);
  await replaceTwins(db, records, latelyRecords);
  return records;
}

/** Trims a growing list back to the leaders once it's twice the size kept. */
function keepBest(twins: Twin[], compare: (a: Twin, b: Twin) => number): Twin[] {
  return twins.length > TWINS_KEPT * 2 ? twins.sort(compare).slice(0, TWINS_KEPT) : twins;
}
