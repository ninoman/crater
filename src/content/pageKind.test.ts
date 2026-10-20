// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { fixtureText } from '../../tests/fixtures';
import { detectPageKind } from './pageKind';

function pageKind(fixture: string) {
  return detectPageKind(new DOMParser().parseFromString(fixtureText(fixture), 'text/html'));
}

describe('detectPageKind', () => {
  it.each(['album-page.html', 'track-page.html'])('calls %s a release', (fixture) => {
    expect(pageKind(fixture)).toBe('release');
  });

  it("calls a band's home page a band, not a release", () => {
    expect(pageKind('band-page.html')).toBe('band');
  });

  it("tells your own fan page from someone else's", () => {
    expect(pageKind('me-fan-page.html')).toBe('own-fan');
    expect(pageKind('fan-page.html')).toBe('fan');
  });

  it('ignores other pages', () => {
    expect(detectPageKind(new DOMParser().parseFromString('<p>hi</p>', 'text/html'))).toBe('other');
  });
});
