// Filters on the recommendation lists (decisions §22): their shape, shared by the worker that applies
// them and the filter bar that sets them, and the plain functions both need.

/** What a list is narrowed to. Every empty or false field is off. */
export interface ListFilters {
  /** Bandcamp genre ids (bandcamp/genres.ts). Empty: any genre. */
  genres: number[];
  /** Only bands whose location holds the place set in Dighead's settings. */
  nearMe: boolean;
  /** Only releases whose artist lets fans pay what they like. */
  nameYourPrice: boolean;
  /** Only releases with a physical edition in stock. */
  physical: boolean;
  /** Release years, inclusive. Null: no limit on that side. */
  yearFrom: number | null;
  yearTo: number | null;
}

export const NO_FILTERS: ListFilters = {
  genres: [],
  nearMe: false,
  nameYourPrice: false,
  physical: false,
  yearFrom: null,
  yearTo: null,
};

/** What the filters judge a release by. Null: not known yet, so the filter can't tell. */
export interface ListFacts {
  genre: number | null;
  location: string | null;
  nameYourPrice: boolean | null;
  physical: boolean | null;
  year: number | null;
}

/**
 * With a filter on, pruning stops working as well: a list that few candidates fit never fills up,
 * so the search would read them all. It stops after this many, and says so (`limited`).
 */
export const FILTER_SEARCH_LIMIT = 4000;

/** What the filters did to a list. */
export interface FilterSummary {
  /** Candidates the filters kept out, among those the list was built from. */
  hidden: number;
  /** Of those, how many had no definite answer: a fact the filter needs isn't known yet. */
  unjudged: number;
  /** The search stopped at its cap, so the list may be missing matches further down. */
  limited: boolean;
}

/** A list that was filtered: with which filters, and what they did. Absent from unfiltered lists. */
export interface AppliedFilters {
  filters: ListFilters;
  summary: FilterSummary;
}

/** The place in settings only counts once it holds something to match. */
export function hasPlace(place: string): boolean {
  return place.trim() !== '';
}

/** Whether any filter would narrow a list, given the place saved in settings. */
export function filtersActive(filters: ListFilters, place: string): boolean {
  return (
    filters.genres.length > 0 ||
    (filters.nearMe && hasPlace(place)) ||
    filters.nameYourPrice ||
    filters.physical ||
    filters.yearFrom !== null ||
    filters.yearTo !== null
  );
}

export function sameFilters(a: ListFilters, b: ListFilters): boolean {
  return (
    a.nearMe === b.nearMe &&
    a.nameYourPrice === b.nameYourPrice &&
    a.physical === b.physical &&
    a.yearFrom === b.yearFrom &&
    a.yearTo === b.yearTo &&
    a.genres.length === b.genres.length &&
    a.genres.every((id) => b.genres.includes(id))
  );
}

const isYear = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 1000 && value <= 9999;

/** Filters read back from storage: anything missing or of the wrong type is switched off. */
export function sanitizeFilters(stored: unknown): ListFilters {
  const raw =
    typeof stored === 'object' && stored !== null ? (stored as Record<string, unknown>) : {};
  const genres = Array.isArray(raw.genres)
    ? [...new Set(raw.genres.filter((id): id is number => Number.isInteger(id)))]
    : [];
  return {
    genres,
    nearMe: raw.nearMe === true,
    nameYourPrice: raw.nameYourPrice === true,
    physical: raw.physical === true,
    yearFrom: isYear(raw.yearFrom) ? raw.yearFrom : null,
    yearTo: isYear(raw.yearTo) ? raw.yearTo : null,
  };
}
