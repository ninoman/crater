import { describe, expect, it } from 'vitest';
import { fixtureText } from '../../tests/fixtures';
import { hasTralbumItem, parseBandId } from './bandPage';
import { ParserError } from './errors';

describe('parseBandId', () => {
  it("reads the band from a band's home page", () => {
    expect(parseBandId(fixtureText('band-page.html'))).toBe(2009518365);
  });

  it('reads the band from a release page', () => {
    expect(parseBandId(fixtureText('album-page.html'))).toBe(2009518365);
  });

  it('returns null without data-band', () => {
    expect(parseBandId('<html><body></body></html>')).toBeNull();
  });

  it('throws ParserError when data-band changes shape', () => {
    expect(() => parseBandId('<script data-band="{&quot;name&quot;:&quot;x&quot;}">')).toThrow(
      ParserError,
    );
  });
});

describe('hasTralbumItem', () => {
  it('is true on release pages', () => {
    expect(hasTralbumItem(fixtureText('album-page.html'))).toBe(true);
    expect(hasTralbumItem(fixtureText('track-page.html'))).toBe(true);
  });

  it("is false on a band's home page, whose data-tralbum is only a url", () => {
    expect(hasTralbumItem(fixtureText('band-page.html'))).toBe(false);
  });

  it('is false without data-tralbum', () => {
    expect(hasTralbumItem('<html></html>')).toBe(false);
  });
});
