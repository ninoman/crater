import { describe, expect, it } from 'vitest';
import { fixtureJson, fixtureText } from '../../tests/fixtures';
import { parseCollectionPage } from './collection';
import { hasCompilationTracks, isCompilation, isVariousArtists } from './compilation';
import { parseReleasePage } from './release';

describe('isVariousArtists', () => {
  it('knows the placeholder artist lines, in any case and with trailing dots', () => {
    for (const artist of [
      'Various Artists',
      'VARIOUS ARTISTS',
      ' various  artists ',
      'Various',
      'VA',
      'V.A.',
      'V/A',
      'Varios Artistas',
      'Artistes Variés',
      'Verschiedene Künstler',
    ]) {
      expect(isVariousArtists(artist), artist).toBe(true);
    }
  });

  it('only matches the whole artist line', () => {
    for (const artist of [
      'Various Artists Collective',
      'Vanity',
      'Variety',
      'Eva',
      'The Various',
    ]) {
      expect(isVariousArtists(artist), artist).toBe(false);
    }
  });
});

describe('isCompilation', () => {
  const album = (title: string, artist = 'Some Label') => isCompilation({ artist, title });

  it('flags a VA prefix in the title, as labels selling their own comps write it', () => {
    expect(album('VA - Summer Sampler 2026')).toBe(true);
    expect(album('V/A: Dub Plates')).toBe(true);
    expect(album('Various Artists – Benefit for Gaza')).toBe(true);
    expect(album('[LBL001] VA - Ten Years')).toBe(true);
  });

  it('flags "Various Artists" anywhere in the title', () => {
    expect(album('Nautilus - Various Artists Compilation Vol.1', 'MBM')).toBe(true);
  });

  it("flags a track by its album's title", () => {
    const track = { artist: 'MBM', title: 'Worg - Hybris' };
    expect(isCompilation(track)).toBe(false);
    expect(
      isCompilation({ ...track, albumTitle: 'Nautilus - Various Artists Compilation Vol.1' }),
    ).toBe(true);
  });

  it('leaves titles alone that only look a bit like one', () => {
    expect(album('Va-Va-Voom')).toBe(false);
    expect(album('Vacation - Live')).toBe(false);
    expect(album('The Compilation')).toBe(false);
    expect(album('Drum Breaks Sampler Vol. 2')).toBe(false);
  });

  it('flags a label sampler whose tracks name their own artists', () => {
    expect(
      isCompilation({
        artist: 'Some Label',
        title: 'Label Showcase',
        trackArtists: ['Ana', 'Bo', 'Cy', 'Ana'],
      }),
    ).toBe(true);
  });
});

describe('hasCompilationTracks', () => {
  it('needs 3 other artists on at least half the tracks', () => {
    expect(hasCompilationTracks('Main', 'LP', ['Ana', 'Bo', null, null, null, null])).toBe(false);
    expect(hasCompilationTracks('Main', 'LP', ['Ana', 'Bo', 'Cy', null, null, null, null])).toBe(
      false,
    );
    expect(hasCompilationTracks('Main', 'LP', ['Ana', 'Bo', 'Cy', null, null, null])).toBe(true);
  });

  it('ignores track artists that name the album artist, or that it names', () => {
    // Guests on one artist's album.
    expect(
      hasCompilationTracks('Main', 'LP', ['Main feat. Ana', 'Main & Bo', 'Main x Cy', 'Main']),
    ).toBe(false);
    // A split whose artist line lists everyone.
    expect(hasCompilationTracks('Ana / Bo / Cy', 'Split', ['Ana', 'Bo', 'Cy', 'Ana'])).toBe(false);
  });

  it('skips remix albums, whose tracks credit the remixers', () => {
    expect(hasCompilationTracks('Main', 'LP Remixed', ['Ana', 'Bo', 'Cy'])).toBe(false);
    expect(hasCompilationTracks('Main', 'The Reworks', ['Ana', 'Bo', 'Cy'])).toBe(false);
  });
});

describe('compilations in parsed pages', () => {
  it('flags a Various Artists comp from its release page', () => {
    const page = parseReleasePage(fixtureText('album-page-compilation.html'));

    expect(page.item).toMatchObject({ artist: 'Various Artists', compilation: true });
  });

  it('flags it from its track artists alone too', () => {
    const page = parseReleasePage(
      fixtureText('album-page-compilation.html').replaceAll(
        '&quot;artist&quot;:&quot;Various Artists&quot;',
        '&quot;artist&quot;:&quot;Jazzman&quot;',
      ),
    );

    expect(page.item).toMatchObject({ artist: 'Jazzman', compilation: true });
  });

  it('leaves a collaboration album and a track page alone', () => {
    expect(parseReleasePage(fixtureText('album-page.html')).item.compilation).toBe(false);
    expect(parseReleasePage(fixtureText('track-page.html')).item.compilation).toBe(false);
    expect(parseReleasePage(fixtureText('album-page-small.html')).item.compilation).toBe(false);
  });

  it('flags only the Various Artists comp among a collection page', () => {
    const { items } = parseCollectionPage(fixtureJson('collection_items-p1.json'));

    expect(items.filter((item) => item.compilation).map((item) => item.artist)).toEqual([
      'Various Artists',
    ]);
  });

  it('flags nothing among a wishlist of single-artist sample packs', () => {
    const { items } = parseCollectionPage(fixtureJson('wishlist_items.json'));

    expect(items.some((item) => item.compilation)).toBe(false);
  });
});
