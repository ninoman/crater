import { describe, expect, it } from 'vitest';
import { fixtureJson } from '../../tests/fixtures';
import { genreIdFromSlug, genreLabel, GENRES } from './genres';

describe('GENRES', () => {
  it('is the genre list bandcamp.com/discover publishes', () => {
    const published = fixtureJson('discover-genres.json') as {
      id: number;
      slug: string;
      label: string;
    }[];
    expect([...GENRES].sort((a, b) => a.id - b.id)).toEqual(published.sort((a, b) => a.id - b.id));
  });

  it('names an id, and finds an id by discover slug', () => {
    expect(genreLabel(10)).toBe('electronic');
    expect(genreLabel(21)).toBe('r&b/soul');
    expect(genreIdFromSlug('hip-hop-rap')).toBe(14);
    expect(genreLabel(999)).toBeNull();
    expect(genreIdFromSlug('shoegaze')).toBeNull();
  });
});
