// Judges a release against the list filters (decisions §25). Pure: the worker supplies the facts.

import { foldText } from '../shared/fold';
import { hasPlace, type ListFacts, type ListFilters } from '../shared/listFilters';

/** `unknown`: no filter failed it, but one needed a fact we don't have. Such releases are hidden. */
export type Verdict = 'pass' | 'fail' | 'unknown';

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Whether a band's location holds any of the places in `place`, which is split at commas
 * ("Berlin, Germany" is Berlin or Germany). Whole words only, accents and case ignored, so
 * "Leipzig, Germany" matches "germany" but "Niger" doesn't match "Nigeria".
 */
export function locationMatches(location: string, place: string): boolean {
  const folded = foldText(location);
  return place
    .split(',')
    .map((part) => foldText(part).trim())
    .filter((part) => part !== '')
    .some((part) =>
      new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(part)}(?![\\p{L}\\p{N}])`, 'u').test(folded),
    );
}

type Check = boolean | null;

/** Each active filter's answer: true it holds, false it doesn't, null the fact is missing. */
function checks(facts: ListFacts, filters: ListFilters, place: string): Check[] {
  const answers: Check[] = [];
  if (filters.genres.length > 0) {
    answers.push(facts.genre === null ? null : filters.genres.includes(facts.genre));
  }
  if (filters.nearMe && hasPlace(place)) {
    answers.push(facts.location === null ? null : locationMatches(facts.location, place));
  }
  if (filters.nameYourPrice) answers.push(facts.nameYourPrice);
  if (filters.physical) answers.push(facts.physical);
  if (filters.yearFrom !== null || filters.yearTo !== null) {
    const { year } = facts;
    answers.push(
      year === null
        ? null
        : year >= (filters.yearFrom ?? -Infinity) && year <= (filters.yearTo ?? Infinity),
    );
  }
  return answers;
}

export function judge(facts: ListFacts, filters: ListFilters, place: string): Verdict {
  const answers = checks(facts, filters, place);
  if (answers.includes(false)) return 'fail';
  return answers.includes(null) ? 'unknown' : 'pass';
}
