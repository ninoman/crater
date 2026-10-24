// Applies the list filters to the candidates a recommender is about to score (decisions §22), so a
// list is cut to length from releases that pass, and keeps count of what it kept out.

import type { ItemKey } from '../../bandcamp';
import { type BandFactsCache, type DigheadDb, getShownWithFacts, type ItemFields } from '../../db';
import { judge } from '../../scoring/listFilters';
import {
  type AppliedFilters,
  FILTER_SEARCH_LIMIT,
  filtersActive,
  hasPlace,
  type ListFilters,
} from '../../shared/listFilters';

/** Candidates are checked this many at a time. */
const CHUNK = 200;

export interface FilterGate {
  /**
   * The records of the keys among `keys` that pass (what getShownFields gives), counting those
   * that don't. Keys with no record are dropped uncounted.
   */
  passing(keys: readonly ItemKey[]): Promise<Map<ItemKey, ItemFields>>;
  /** The first `want` items that pass, in order, looking at them a chunk at a time. */
  firstPassing<T>(items: readonly T[], keyOf: (item: T) => ItemKey, want: number): Promise<T[]>;
  /** The search has looked at as many candidates as it may. */
  readonly exhausted: boolean;
  /** Records that the search stopped at its limit rather than running out of candidates. */
  stoppedAtLimit(): void;
  /** The filters and what they did, for the result. */
  applied(): AppliedFilters;
}

/** A gate for these filters, or null when none would narrow a list. */
export function createFilterGate(
  db: DigheadDb,
  filters: ListFilters | undefined,
  place: string,
): FilterGate | null {
  if (!filters || !filtersActive(filters, place)) return null;
  // Bands are read only for the filters that judge them, and once per request.
  const bands: BandFactsCache | null =
    filters.genres.length > 0 || (filters.nearMe && hasPlace(place)) ? new Map() : null;
  let examined = 0;
  let hidden = 0;
  let unjudged = 0;
  let limited = false;
  const gate: FilterGate = {
    async passing(keys) {
      const shown = await getShownWithFacts(db, keys, { bands });
      const passed = new Map<ItemKey, ItemFields>();
      for (const key of keys) {
        const known = shown.get(key);
        if (!known) continue;
        examined++;
        const verdict = judge(known.facts, filters, place);
        if (verdict === 'pass') passed.set(key, known.item);
        else {
          hidden++;
          if (verdict === 'unknown') unjudged++;
        }
      }
      return passed;
    },
    async firstPassing(items, keyOf, want) {
      const kept: (typeof items)[number][] = [];
      for (let start = 0; start < items.length && kept.length < want; start += CHUNK) {
        if (gate.exhausted) {
          limited = true;
          break;
        }
        const chunk = items.slice(start, start + CHUNK);
        const passed = await gate.passing(chunk.map(keyOf));
        kept.push(...chunk.filter((item) => passed.has(keyOf(item))));
      }
      return kept.slice(0, want);
    },
    get exhausted() {
      return examined >= FILTER_SEARCH_LIMIT;
    },
    stoppedAtLimit() {
      limited = true;
    },
    applied: () => ({ filters, summary: { hidden, unjudged, limited } }),
  };
  return gate;
}
