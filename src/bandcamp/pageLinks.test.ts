// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { fixtureText } from '../../tests/fixtures';
import { findReleaseLinks, releaseUrl } from './pageLinks';

function page(name: string): Document {
  return new DOMParser().parseFromString(fixtureText(name), 'text/html');
}

describe('releaseUrl', () => {
  const base = 'https://floatingpoints.bandcamp.com/music';

  it('normalises album and track links', () => {
    expect(releaseUrl('/album/promises', base)).toBe(
      'https://floatingpoints.bandcamp.com/album/promises',
    );
    expect(releaseUrl('https://Peacefrog.bandcamp.com/track/x/?from=feed#top', base)).toBe(
      'https://peacefrog.bandcamp.com/track/x',
    );
    expect(releaseUrl('http://music.label.com/album/y', base)).toBe(
      'https://music.label.com/album/y',
    );
  });

  it('ignores everything else', () => {
    for (const href of [
      '/music',
      'https://bandcamp.com/jiggypol',
      '/album/a/b',
      '/album/',
      'mailto:x@y.z',
      'javascript:void(0)',
      'https://f4.bcbits.com/download/track/abc',
      'http://[bad',
    ]) {
      expect(releaseUrl(href, base), href).toBeNull();
    }
  });
});

describe('findReleaseLinks', () => {
  it("reads ids from a fan page's collection cards, one link each", () => {
    const doc = page('fan-page.html');
    const links = findReleaseLinks(doc, 'https://bandcamp.com/jiggypol');
    const cards = doc.querySelectorAll('li.collection-item-container');
    expect(cards.length).toBe(10);
    const carded = links.filter((link) => link.anchor.closest('li.collection-item-container'));
    expect(carded).toHaveLength(10);
    expect(carded[0]).toMatchObject({
      url: 'https://floatingpoints.bandcamp.com/album/promises',
      itemKey: 'a3149089081',
    });
    expect(carded[0]?.anchor.classList.contains('item-link')).toBe(true);
  });

  it("reads ids from a band page's music grid and resolves relative links", () => {
    const links = findReleaseLinks(
      page('band-page.html'),
      'https://floatingpoints.bandcamp.com/music',
    );
    const cascade = links.find((link) => link.url.endsWith('/album/cascade'));
    expect(cascade).toMatchObject({
      url: 'https://floatingpoints.bandcamp.com/album/cascade',
      itemKey: 'a1204527868',
    });
    expect(links.every((link) => link.itemKey !== null)).toBe(true);
  });

  it("badges a release page's recommendations once each, but not its own tracklist", () => {
    const url = 'https://floatingpoints.bandcamp.com/album/promises';
    const doc = page('album-page.html');
    const links = findReleaseLinks(doc, url);
    const from = links.find(
      (link) => link.url === 'https://charleswebster.bandcamp.com/album/from-the-hill',
    );
    expect(from?.itemKey).toBe('a1076185069');
    expect(from?.anchor.classList.contains('go-to-album')).toBe(false);
    expect(links.filter((link) => link.url === from?.url)).toHaveLength(1);
    expect(links.some((link) => link.url === url)).toBe(false);
    expect(links.some((link) => link.anchor.closest('#track_table'))).toBe(false);
  });

  it("finds a track page's album but not the track itself", () => {
    const url = 'https://floatingpoints.bandcamp.com/track/movement-1';
    const links = findReleaseLinks(page('track-page.html'), url);
    expect(links.some((link) => link.url === url)).toBe(false);
    expect(
      links.some((link) => link.url === 'https://floatingpoints.bandcamp.com/album/promises'),
    ).toBe(true);
  });

  it('skips image-only, buy and already-seen links', () => {
    const doc = new DOMParser().parseFromString(
      `<ul><li><a href="/album/a"><img src="x"></a><a href="/album/a">A</a></li></ul>
       <a href="https://x.bandcamp.com/album/b?action=buy">buy now</a>
       <p><a href="/track/c">C</a> and again <a href="/track/c">C</a></p>`,
      'text/html',
    );
    const seen = new WeakSet<Element>();
    const first = findReleaseLinks(doc, 'https://x.bandcamp.com/', seen);
    expect(first.map((link) => [link.url, link.anchor.textContent])).toEqual([
      ['https://x.bandcamp.com/album/a', 'A'],
      ['https://x.bandcamp.com/track/c', 'C'],
      ['https://x.bandcamp.com/track/c', 'C'],
    ]);
    expect(findReleaseLinks(doc, 'https://x.bandcamp.com/', seen)).toEqual([]);
    doc.body.insertAdjacentHTML('beforeend', '<a href="/album/d">D</a>');
    expect(findReleaseLinks(doc, 'https://x.bandcamp.com/', seen).map((l) => l.url)).toEqual([
      'https://x.bandcamp.com/album/d',
    ]);
  });
});
