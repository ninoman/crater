import { describe, expect, it } from 'vitest';
import { fixtureText } from '../../tests/fixtures';
import { ParserError } from './errors';
import { parseReleasePreview } from './preview';

describe('parseReleasePreview', () => {
  it('lists an album’s streamable tracks, starting at the featured one', () => {
    const preview = parseReleasePreview(fixtureText('album-page.html'));

    expect(preview.tracks.length).toBeGreaterThan(1);
    expect(preview.startIndex).toBe(0);
    expect(preview.matchKey).toMatch(/^a\d+$/);
    expect(preview.tracks[0]).toEqual({
      title: 'Movement 1',
      duration: 384.152,
      streamUrl: expect.stringMatching(
        /^https:\/\/t4\.bcbits\.com\/stream\/.+\/mp3-128\/3961474810\?/,
      ) as string,
    });
  });

  it('decodes entities in the stream URL', () => {
    const { tracks } = parseReleasePreview(fixtureText('album-page.html'));
    expect(tracks[0]?.streamUrl).toContain('&ts=');
    expect(tracks[0]?.streamUrl).not.toContain('&amp;');
  });

  it('reads the single track of a track page', () => {
    const preview = parseReleasePreview(fixtureText('track-page.html'));
    const album = parseReleasePreview(fixtureText('album-page.html'));
    expect(preview.tracks).toHaveLength(1);
    // The fixture's track is on the album fixture, so a play of it marks the album heard.
    expect(preview.matchKey).toBe(album.matchKey);
    expect(preview.tracks[0]?.title).toBe('Movement 1');
  });

  it('skips tracks with no stream and starts at the featured track', () => {
    const tralbum = {
      featured_track_id: 3,
      trackinfo: [
        { track_id: 1, title: 'One', duration: 10, file: { 'mp3-128': 'https://x/1' } },
        { track_id: 2, title: 'Two', duration: 20, file: null },
        { track_id: 3, title: 'Three', duration: 30, file: { 'mp3-128': 'https://x/3' } },
      ],
    };
    const html = `<div data-tralbum="${JSON.stringify(tralbum).replace(/"/g, '&quot;')}"></div>`;

    const preview = parseReleasePreview(html);

    expect(preview.tracks.map((t) => t.title)).toEqual(['One', 'Three']);
    expect(preview.startIndex).toBe(1);
    expect(preview.matchKey).toBeNull();
  });

  it('throws a ParserError without data-tralbum', () => {
    expect(() => parseReleasePreview('<html></html>')).toThrow(ParserError);
  });
});
