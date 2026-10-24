import { describe, expect, it } from 'vitest';
import { fixtureJson } from '../../tests/fixtures';
import { parseDiscography, parseReleaseDetails, toDiscographyRelease } from './discography';
import { BandcampApiError, ParserError } from './errors';

describe('parseDiscography', () => {
  it("reads an artist's releases with their dates, newest first as Bandcamp lists them", () => {
    const { bandId, name, releases } = parseDiscography(fixtureJson('band_details.json'));
    expect(bandId).toBe(2009518365);
    expect(name).toBe('Floating Points');
    expect(releases).toHaveLength(28);
    expect(releases[0]).toEqual({
      itemKey: 'a533227808',
      sellerId: 2009518365,
      title: 'Mere Mortals',
      artist: 'Floating Points',
      artId: 1914048566,
      releasedAt: Date.UTC(2026, 7, 28),
    });
    expect(releases.some((release) => release.itemKey.startsWith('t'))).toBe(true);
  });

  it("keeps a label's artists as the artist line and their accounts as the seller", () => {
    const { bandId, releases } = parseDiscography(fixtureJson('band_details-label.json'));
    expect(bandId).toBe(3648395603);
    const sellers = new Set(releases.map((release) => release.sellerId));
    expect(sellers.size).toBeGreaterThan(1);
    expect(sellers.has(3648395603)).toBe(true);
    const other = releases.find((release) => release.sellerId !== bandId);
    expect(other?.artist).not.toBe('Peacefrog Records');
  });

  it('turns an unknown band into a BandcampApiError', () => {
    expect(() => parseDiscography(fixtureJson('band_details-unknown.json'))).toThrow(
      BandcampApiError,
    );
  });

  it('throws ParserError when the discography changes shape', () => {
    expect(() => parseDiscography({ id: 1, name: 'x', discography: [{ item_id: 'x' }] })).toThrow(
      ParserError,
    );
  });

  it('skips kinds it does not track and tolerates a missing date or art', () => {
    const raw = {
      item_id: 1,
      item_type: 'album',
      artist_name: null,
      band_name: 'B',
      band_id: 2,
      title: 'T',
      art_id: null,
      release_date: null,
    };
    expect(toDiscographyRelease({ ...raw, item_type: 'package' })).toBeNull();
    expect(toDiscographyRelease(raw)).toMatchObject({ artist: 'B', artId: null, releasedAt: null });
  });
});

describe('parseReleaseDetails', () => {
  it("reads an album's URL and release date", () => {
    expect(parseReleaseDetails(fixtureJson('tralbum_details.json'))).toEqual({
      itemKey: 'a533227808',
      albumKey: null,
      url: 'https://floatingpoints.bandcamp.com/album/mere-mortals',
      releasedAt: Date.UTC(2026, 7, 28),
      preorder: false,
    });
  });

  it('reads a single track, which belongs to no album', () => {
    expect(parseReleaseDetails(fixtureJson('tralbum_details-track.json'))).toMatchObject({
      itemKey: 't1640082601',
      albumKey: null,
      url: 'https://peacefrog.bandcamp.com/track/sundae-kev',
    });
  });

  it("links an album's track to its album", () => {
    const track = { id: 5, type: 't', bandcamp_url: 'https://x.bandcamp.com/track/y', album_id: 9 };
    expect(parseReleaseDetails(track).albumKey).toBe('a9');
  });

  it('turns a missing release into a BandcampApiError', () => {
    expect(() => parseReleaseDetails({ error: true, error_message: 'No such tralbum' })).toThrow(
      BandcampApiError,
    );
  });

  it('throws ParserError without a URL', () => {
    expect(() => parseReleaseDetails({ id: 5, type: 'a' })).toThrow(ParserError);
  });
});
