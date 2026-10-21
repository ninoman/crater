import { describe, expect, it } from 'vitest';
import { fixtureText } from '../../tests/fixtures';
import { ParserError } from './errors';
import { parseFanProfile } from './fanProfile';

const signedIn = fixtureText('fan-page-in-common.html');

/** The signed-in fixture with its header's genre line replaced. */
function withGenreLine(line: string | null): string {
  const replaced = signedIn.replace(
    /<li class="genre-wrapper">[\s\S]*?<\/li>/,
    line === null ? '' : `<li class="genre-wrapper">\n  ${line}\n</li>`,
  );
  if (replaced === signedIn) throw new Error('genre line not found in the fixture');
  return replaced;
}

describe('parseFanProfile', () => {
  it('reads the in-common count, collection size, genre and location signed in', () => {
    expect(parseFanProfile(signedIn)).toEqual({
      fanId: 9625999,
      username: 'otfx',
      itemCount: 857,
      inCommon: 8,
      favouriteGenre: 'Electronic',
      location: 'Berlin, Germany',
      signedIn: true,
    });
  });

  it('reads a count without a favourite genre, and a single item', () => {
    expect(parseFanProfile(withGenreLine('8 items in common')).inCommon).toBe(8);
    expect(parseFanProfile(withGenreLine('Rock, 1 item in common')).inCommon).toBe(1);
    expect(parseFanProfile(withGenreLine('Hip-Hop/Rap, 1,204 items in common')).inCommon).toBe(
      1204,
    );
  });

  it('reads 0 when signed in and the count is left out', () => {
    expect(parseFanProfile(withGenreLine('Electronic')).inCommon).toBe(0);
    expect(parseFanProfile(withGenreLine(null)).inCommon).toBe(0);
  });

  it('throws on text it does not recognise rather than reading 0', () => {
    expect(() => parseFanProfile(withGenreLine('Electrónica, 8 artículos en común'))).toThrow(
      ParserError,
    );
    expect(() => parseFanProfile(withGenreLine('Electronic, in common with you'))).toThrow(
      ParserError,
    );
    const noHeader = signedIn.replace(/<ol class="info-items"/, '<ol class="facts"');
    expect(() => parseFanProfile(noHeader)).toThrow(ParserError);
  });

  it('has no count logged out, where Bandcamp never shows one', () => {
    expect(parseFanProfile(fixtureText('fan-page-medium.html'))).toMatchObject({
      fanId: 1138719,
      itemCount: 122,
      inCommon: null,
      favouriteGenre: 'Alternative',
      signedIn: false,
    });
  });

  it('has no count on your own page', () => {
    expect(parseFanProfile(fixtureText('me-fan-page.html'))).toMatchObject({
      inCommon: null,
      signedIn: true,
    });
  });

  it('throws ParserError on a page without fan data', () => {
    expect(() => parseFanProfile(fixtureText('album-page.html'))).toThrow(ParserError);
  });
});
