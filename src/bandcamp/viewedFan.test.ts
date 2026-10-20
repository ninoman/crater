import { describe, expect, it } from 'vitest';
import { fixtureText } from '../../tests/fixtures';
import { ParserError } from './errors';
import { parseViewedFanId } from './viewedFan';

describe('parseViewedFanId', () => {
  it('reads the fan whose profile it is', () => {
    expect(parseViewedFanId(fixtureText('fan-page.html'))).toBe(5325531);
    expect(parseViewedFanId(fixtureText('fan-page-medium.html'))).toBe(1138719);
  });

  it('reads your own page too', () => {
    expect(parseViewedFanId(fixtureText('me-fan-page.html'))).toBe(7027105);
  });

  it('returns null without #pagedata', () => {
    expect(parseViewedFanId('<html><body></body></html>')).toBeNull();
  });

  it('throws ParserError on a page that is not a fan page', () => {
    expect(() => parseViewedFanId(fixtureText('album-page.html'))).toThrow(ParserError);
  });
});
