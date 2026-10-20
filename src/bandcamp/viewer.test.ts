import { describe, expect, it } from 'vitest';
import { fixtureText } from '../../tests/fixtures';
import { ParserError } from './errors';
import { parseViewer } from './viewer';

/** Builds a `#pagedata` element the way a browser serializes it. */
function pagedataHtml(blob: object): string {
  const escaped = JSON.stringify(blob).replaceAll('&', '&amp;').replaceAll('"', '&quot;');
  return `<div id="pagedata" data-blob="${escaped}"></div>`;
}

describe('parseViewer', () => {
  it.each(['fan-page.html', 'album-page.html', 'track-page.html'])(
    'returns null on a logged-out %s',
    (fixture) => {
      expect(parseViewer(fixtureText(fixture))).toBeNull();
    },
  );

  it('reads the logged-in fan from your own fan page', () => {
    expect(parseViewer(fixtureText('me-fan-page.html'))).toEqual({
      fanId: 7027105,
      username: 'randoom_taker',
    });
  });

  it('reads the logged-in fan', () => {
    const html = pagedataHtml({
      identities: { fan: { id: 42, username: 'digger', name: 'D & G' } },
    });

    expect(parseViewer(html)).toEqual({ fanId: 42, username: 'digger' });
  });

  it('returns null for a page without #pagedata or identities', () => {
    expect(parseViewer('<html><body></body></html>')).toBeNull();
    expect(parseViewer(pagedataHtml({ other: true }))).toBeNull();
  });

  it('throws ParserError when the fan identity changes shape', () => {
    expect(() => parseViewer(pagedataHtml({ identities: { fan: { id: '42' } } }))).toThrow(
      ParserError,
    );
  });
});
