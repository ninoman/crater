import { describe, expect, it } from 'vitest';
import { fixtureJson } from '../../tests/fixtures';
import { parseApiRelease, parseApiReleasePreview } from './apiRelease';
import { BandcampApiError } from './errors';

const album = () => fixtureJson('tralbum_details-custom-domain.json');
const track = () => fixtureJson('tralbum_details-custom-domain-track.json');

describe('parseApiRelease', () => {
  it('reads an album as its page would', () => {
    const { item, album: parent } = parseApiRelease(album());
    expect(item).toMatchObject({
      itemKey: 'a450307620',
      albumKey: null,
      title: 'Sidewinder EP',
      artist: 'Per Hammar',
      bandId: 3695260806,
      url: 'https://craigieknowes.com/album/sidewinder-ep',
      compilation: false,
    });
    expect(item.tags).toContain('tech house');
    expect(parent).toBeNull();
  });

  it('points a track at its album', () => {
    const { item, album: parent } = parseApiRelease(track());
    expect(item.albumKey).toBe('a450307620');
    expect(parent).toEqual({ itemKey: 'a450307620', url: 'https://craigieknowes.com' });
  });

  it('treats a release that is gone as an API error', () => {
    expect(() => parseApiRelease({ error: true, error_message: 'gone' })).toThrow(BandcampApiError);
  });
});

describe('parseApiReleasePreview', () => {
  it('lists streamable tracks and starts on the featured one', () => {
    const preview = parseApiReleasePreview(album());
    expect(preview.matchKey).toBe('a450307620');
    expect(preview.tracks.map((t) => t.title)).toEqual([
      'Sidewinder',
      'Viper',
      'Afterglow',
      'Mono Boy',
    ]);
    expect(preview.tracks[0]?.streamUrl).toContain('stream_redirect');
    expect(preview.startIndex).toBe(2);
  });

  it("marks a track's album heard", () => {
    expect(parseApiReleasePreview(track()).matchKey).toBe('a450307620');
  });
});
