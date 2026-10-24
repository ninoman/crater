import { describe, expect, it } from 'vitest';
import {
  cleanLocation,
  genreOfDiscoverUrl,
  nameYourPriceOf,
  physicalFromMerch,
  physicalFromPackages,
  yearOf,
} from './facts';

describe('facts', () => {
  it('trims a location and drops a blank one', () => {
    expect(cleanLocation(' Leipzig, Germany ')).toBe('Leipzig, Germany');
    expect(cleanLocation('  ')).toBeNull();
    expect(cleanLocation(null)).toBeNull();
  });

  it('reads the UTC year of a Bandcamp date', () => {
    expect(yearOf('26 Mar 2021 00:00:00 GMT')).toBe(2021);
    expect(yearOf('31 Dec 2019 23:59:59 GMT')).toBe(2019);
    expect(yearOf('not a date')).toBeNull();
    expect(yearOf(undefined)).toBeNull();
  });

  it('turns is_set_price round: a fixed price is not name your price', () => {
    expect(nameYourPriceOf(true)).toBe(false);
    expect(nameYourPriceOf(false)).toBe(true);
    expect(nameYourPriceOf(null)).toBeNull();
  });

  it('says a collection row has a physical edition when merch is listed and not all sold out', () => {
    expect(physicalFromMerch([1, 2], false)).toBe(true);
    expect(physicalFromMerch([1], true)).toBe(false);
    expect(physicalFromMerch(null, null)).toBe(false);
    expect(physicalFromMerch([], false)).toBe(false);
  });

  it('says a page has a physical edition when a public, non-ticket package has stock', () => {
    expect(physicalFromPackages([{ quantity_available: null }])).toBe(true);
    expect(physicalFromPackages([{ quantity_available: 0 }, { quantity_available: 4 }])).toBe(true);
    expect(physicalFromPackages([{ quantity_available: 0 }])).toBe(false);
    expect(physicalFromPackages([{ quantity_available: 9, is_live_ticket: true }])).toBe(false);
    expect(physicalFromPackages([{ quantity_available: 9, private: true }])).toBe(false);
    expect(physicalFromPackages([])).toBe(false);
  });

  it('finds a genre id behind a discover link', () => {
    expect(genreOfDiscoverUrl('https://bandcamp.com/discover/electronic')).toBe(10);
    expect(genreOfDiscoverUrl('https://bandcamp.com/discover/post-metal')).toBeNull();
    expect(genreOfDiscoverUrl('https://example.com/discover/electronic')).toBeNull();
    expect(genreOfDiscoverUrl(undefined)).toBeNull();
  });
});
