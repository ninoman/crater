import { describe, expect, it } from 'vitest';
import { fixtureJson } from '../../tests/fixtures';
import { BandcampApiError } from './errors';
import { parseSupportersPage } from './supporters';

describe('parseSupportersPage', () => {
  it('parses a page of thumbs', () => {
    const page = parseSupportersPage(fixtureJson('tralbumcollectors-thumbs-p2.json'), 'thumbs');

    expect(page.supporters).toHaveLength(100);
    expect(page.moreAvailable).toBe(true);
    expect(page.supporters[0]).toEqual({
      fanId: 1666893,
      username: 'igorduarte',
      name: 'igorduarte',
      imageId: 10413869,
      token: '1:1788543878:1666893:0:1:0',
      purchasedAt: 1788543878000,
      isReviewer: false,
    });
  });

  it('marks reviewers', () => {
    const page = parseSupportersPage(fixtureJson('tralbumcollectors-reviews-p2.json'), 'reviews');

    expect(page.supporters).toHaveLength(20);
    expect(page.supporters.every((s) => s.isReviewer)).toBe(true);
  });

  it('throws BandcampApiError on an error response', () => {
    expect(() => parseSupportersPage({ error: true }, 'thumbs')).toThrow(BandcampApiError);
  });
});
