import { describe, expect, it } from 'vitest';
import { filtersActive, NO_FILTERS, sameFilters, sanitizeFilters } from './listFilters';

describe('filtersActive', () => {
  it('is off for the empty filters', () => {
    expect(filtersActive(NO_FILTERS, 'Berlin')).toBe(false);
  });

  it('is on for any one field', () => {
    for (const patch of [
      { genres: [10] },
      { nameYourPrice: true },
      { physical: true },
      { yearFrom: 2020 },
      { yearTo: 2024 },
    ]) {
      expect(filtersActive({ ...NO_FILTERS, ...patch }, '')).toBe(true);
    }
  });

  it('counts near me only once a place is set', () => {
    const nearMe = { ...NO_FILTERS, nearMe: true };
    expect(filtersActive(nearMe, '')).toBe(false);
    expect(filtersActive(nearMe, '  ')).toBe(false);
    expect(filtersActive(nearMe, 'Berlin')).toBe(true);
  });
});

describe('sameFilters', () => {
  it('ignores the order of genres', () => {
    expect(sameFilters({ ...NO_FILTERS, genres: [1, 2] }, { ...NO_FILTERS, genres: [2, 1] })).toBe(
      true,
    );
  });

  it('tells any other difference', () => {
    expect(sameFilters(NO_FILTERS, { ...NO_FILTERS, genres: [1] })).toBe(false);
    expect(sameFilters(NO_FILTERS, { ...NO_FILTERS, yearFrom: 2000 })).toBe(false);
    expect(sameFilters(NO_FILTERS, { ...NO_FILTERS, physical: true })).toBe(false);
  });
});

describe('sanitizeFilters', () => {
  it('turns off whatever is missing or of the wrong type', () => {
    expect(sanitizeFilters(undefined)).toEqual(NO_FILTERS);
    expect(sanitizeFilters('x')).toEqual(NO_FILTERS);
    expect(
      sanitizeFilters({
        genres: [10, 'a', 10, 1.5, 3],
        nearMe: 'yes',
        physical: true,
        yearFrom: '2020',
        yearTo: 99999,
      }),
    ).toEqual({ ...NO_FILTERS, genres: [10, 3], physical: true });
  });

  it('keeps a valid set as it was', () => {
    const filters = {
      genres: [2, 10],
      nearMe: true,
      nameYourPrice: true,
      physical: true,
      yearFrom: 2018,
      yearTo: 2024,
    };
    expect(sanitizeFilters(filters)).toEqual(filters);
  });
});
