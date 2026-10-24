import { describe, expect, it } from 'vitest';
import { type ListFacts, type ListFilters, NO_FILTERS } from '../shared/listFilters';
import { judge, locationMatches } from './listFilters';

const known: ListFacts = {
  genre: 10,
  location: 'Leipzig, Germany',
  nameYourPrice: true,
  physical: true,
  year: 2022,
};
const unknown: ListFacts = {
  genre: null,
  location: null,
  nameYourPrice: null,
  physical: null,
  year: null,
};

const verdict = (facts: ListFacts, patch: Partial<ListFilters>, place = '') =>
  judge(facts, { ...NO_FILTERS, ...patch }, place);

describe('judge', () => {
  it('passes everything when no filter is on', () => {
    expect(verdict(known, {})).toBe('pass');
    expect(verdict(unknown, {})).toBe('pass');
  });

  it('passes a release in any of the chosen genres and fails one in another', () => {
    expect(verdict(known, { genres: [3, 10] })).toBe('pass');
    expect(verdict(known, { genres: [3] })).toBe('fail');
  });

  it('keeps year limits inclusive and open on a missing side', () => {
    expect(verdict(known, { yearFrom: 2022, yearTo: 2022 })).toBe('pass');
    expect(verdict(known, { yearFrom: 2023 })).toBe('fail');
    expect(verdict(known, { yearTo: 2021 })).toBe('fail');
    expect(verdict(known, { yearTo: 2030 })).toBe('pass');
  });

  it('checks name your price and physical as show-only switches', () => {
    expect(verdict(known, { nameYourPrice: true, physical: true })).toBe('pass');
    expect(verdict({ ...known, nameYourPrice: false }, { nameYourPrice: true })).toBe('fail');
    expect(verdict({ ...known, physical: false }, { physical: true })).toBe('fail');
    // Off means no opinion, not "only without".
    expect(verdict({ ...known, physical: false }, {})).toBe('pass');
  });

  it('matches near me against the place, and ignores the switch while there is no place', () => {
    expect(verdict(known, { nearMe: true }, 'Leipzig')).toBe('pass');
    expect(verdict(known, { nearMe: true }, 'Berlin')).toBe('fail');
    expect(verdict(unknown, { nearMe: true }, '')).toBe('pass');
  });

  it('cannot judge a release whose needed fact is missing, so it is "unknown"', () => {
    expect(verdict(unknown, { genres: [10] })).toBe('unknown');
    expect(verdict(unknown, { nameYourPrice: true })).toBe('unknown');
    expect(verdict(unknown, { yearFrom: 2000 })).toBe('unknown');
    expect(verdict(unknown, { nearMe: true }, 'Berlin')).toBe('unknown');
  });

  it('only needs the facts of the filters that are on', () => {
    expect(verdict({ ...unknown, genre: 10 }, { genres: [10] })).toBe('pass');
  });

  it('fails on a definite miss even when another fact is missing', () => {
    expect(verdict({ ...unknown, genre: 3 }, { genres: [10], yearFrom: 2000 })).toBe('fail');
  });
});

describe('locationMatches', () => {
  it('matches a city or a country, ignoring case and accents', () => {
    expect(locationMatches('Leipzig, Germany', 'germany')).toBe(true);
    expect(locationMatches('Leipzig, Germany', 'LEIPZIG')).toBe(true);
    expect(locationMatches('Istanbul, Türkiye', 'turkiye')).toBe(true);
    expect(locationMatches('Zürich, Switzerland', 'Zurich')).toBe(true);
  });

  it('matches whole words only', () => {
    expect(locationMatches('Lagos, Nigeria', 'Niger')).toBe(false);
    expect(locationMatches('Portland, Oregon', 'Port')).toBe(false);
    expect(locationMatches('New York, NY', 'York')).toBe(true);
  });

  it('treats commas in the place as "or"', () => {
    expect(locationMatches('Leipzig, Germany', 'Berlin, Germany')).toBe(true);
    expect(locationMatches('Paris, France', 'Berlin, Germany')).toBe(false);
  });

  it('takes the place literally, not as a pattern', () => {
    expect(locationMatches('Leipzig, Germany', '.*')).toBe(false);
    expect(locationMatches("St. John's, Canada", "St. John's")).toBe(true);
  });

  it('matches nothing for a blank place', () => {
    expect(locationMatches('Leipzig, Germany', ' , ')).toBe(false);
  });
});
