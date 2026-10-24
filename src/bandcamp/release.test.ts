import { describe, expect, it } from 'vitest';
import { fixtureText } from '../../tests/fixtures';
import { ParserError } from './errors';
import { parseReleasePage } from './release';

describe('parseReleasePage', () => {
  it('parses an album page', () => {
    const page = parseReleasePage(fixtureText('album-page.html'));

    expect(page.item).toMatchObject({
      itemKey: 'a3149089081',
      albumKey: null,
      title: 'Promises',
      artist: 'Floating Points, Pharoah Sanders & The London Symphony Orchestra',
      bandId: 2009518365,
      url: 'https://floatingpoints.bandcamp.com/album/promises',
      artId: 2975740667,
    });
    expect(page.item.tags).toEqual(
      expect.arrayContaining(['electronic', 'jazz', 'united kingdom', 'modern classical']),
    );
    expect(new Set(page.item.tags).size).toBe(page.item.tags.length);
  });

  it('reads reviewers first, then thumbs, from the collectors blob', () => {
    const page = parseReleasePage(fixtureText('album-page.html'));

    expect(page.supporters).toHaveLength(86);
    expect(page.supporters.filter((s) => s.isReviewer)).toHaveLength(6);
    expect(page.supporters[0]).toMatchObject({ fanId: 11497112, isReviewer: true });
    expect(page.supporters[6]).toEqual({
      fanId: 5325531,
      username: 'jiggypol',
      name: 'jiggypol',
      imageId: 20054359,
      token: '1:1792430325:5325531:0:1:0',
      purchasedAt: 1792430325000,
      isReviewer: false,
    });
    expect(page.moreThumbsAvailable).toBe(true);
    expect(page.moreReviewsAvailable).toBe(true);
  });

  it('links a track page to its album', () => {
    const page = parseReleasePage(fixtureText('track-page.html'));

    expect(page.item.itemKey).toBe('t3961474810');
    expect(page.item.albumKey).toBe('a3149089081');
    expect(page.item.title).toBe('Movement 1');
    expect(page.supporters).toHaveLength(80);
  });

  it('parses a small release with no more supporters', () => {
    const page = parseReleasePage(fixtureText('album-page-small.html'));

    expect(page.supporters).toHaveLength(3);
    expect(page.moreThumbsAvailable).toBe(false);
    expect(page.moreReviewsAvailable).toBe(false);
  });

  it('throws ParserError when the page has no release data', () => {
    expect(() => parseReleasePage(fixtureText('fan-page.html'))).toThrow(ParserError);
  });
});
