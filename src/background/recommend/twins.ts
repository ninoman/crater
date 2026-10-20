// Recomputes the taste-twins leaderboard: your basis once, then every read fan in pages, with a
// yield between pages so the worker never blocks for long.

import {
  gatherTwinBasis,
  readTwinCandidates,
  replaceTwins,
  type DigheadDb,
  type TwinRecord,
} from '../../db';
import { compareTwins, scoreTwin, type Twin, type TwinInput } from '../../scoring/twins';
import { supporters, weight } from '../../scoring/weights';
import type { Settings } from '../../shared/settings';

/** The leaderboard keeps this many. For you only reads the top `topTwinsK`. */
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

export async function computeTwins(deps: TwinsDeps, meFanId: number): Promise<TwinRecord[]> {
  const { db, settings } = deps;
  const basis = await gatherTwinBasis(db, meFanId);
  const weights = new Map<number, number>();
  for (const [id, counts] of basis.counts) {
    weights.set(id, weight(supporters(counts.bandcampCounts, counts.knownOwners)));
  }
  const input: TwinInput = {
    mine: basis.mine,
    weights,
    labelOf: basis.labelOf,
    catalogSize: basis.catalogSize,
    minCollectionSize: settings.minCollectionSize,
    maxCollectionSize: settings.maxCollectionSize,
    labelClusterDownweight: settings.labelClusterDownweight,
  };

  let best: Twin[] = [];
  for (let after: number | null = -Infinity; after !== null && basis.mine.length > 0;) {
    const page = await readTwinCandidates(db, after, PAGE, meFanId);
    for (const candidate of page.candidates) {
      const twin = scoreTwin(candidate, input);
      if (twin) best.push(twin);
    }
    if (best.length > TWINS_KEPT * 2) best = best.sort(compareTwins).slice(0, TWINS_KEPT);
    after = page.next;
    await deps.yieldNow();
  }

  const records = best
    .sort(compareTwins)
    .slice(0, TWINS_KEPT)
    .map((twin): TwinRecord => ({ ...twin, computedAt: deps.now }));
  await replaceTwins(db, records);
  return records;
}
