import { describe, expect, it } from 'vitest';
import { fixtureJson, fixtureText } from '../../tests/fixtures';
import { FAN_PAGE_DOM } from './fanPageDom';
import { parseFanPage } from './fanPage';
import { followCardHtml } from './followCard';
import { parseFollowingPage } from './following';

/** Whitespace and trailing class spaces are layout, not markup. */
const normalize = (html: string) =>
  html.replace(/\s+/g, ' ').replace(/> </g, '><').replace(/ "/g, '"').trim();

function fixtureCards(): { fans: string[]; bands: string[] } {
  const html = fixtureText('me-following-tab.html');
  const split = (part: string) =>
    part
      .split(/(?=<li [^>]*class="followeer)/)
      .filter((s) => s.startsWith('<li'))
      .map((s) => normalize(s.slice(0, s.indexOf('</li>') + 5)));
  const bandsAt = html.indexOf('<div id="following-bands-container"');
  return { fans: split(html.slice(0, bandsAt)), bands: split(html.slice(bandsAt)) };
}

describe('followCardHtml', () => {
  const cards = fixtureCards();

  it('matches Bandcamp’s fan cards', () => {
    const { rows } = parseFollowingPage(fixtureJson('following_fans.json'), 'fan');

    expect(rows.map((row) => normalize(followCardHtml(row)))).toEqual(cards.fans);
  });

  it('matches Bandcamp’s band cards', () => {
    // Captured minutes apart, so the tab has one newer follow and a few ties sorted differently:
    // match by id, not by position.
    const rows = parseFanPage(fixtureText('me-fan-page.html')).following.bands.firstRows;
    const byId = new Map(cards.bands.map((card) => [/band_(\d+)"/.exec(card)?.[1], card]));

    expect(rows.length).toBeGreaterThan(40);
    for (const row of rows) expect(normalize(followCardHtml(row))).toBe(byId.get(String(row.id)));
  });

  it('escapes names and links', () => {
    const html = followCardHtml({
      kind: 'band',
      id: 1,
      name: 'Ital & "Halal" <b>',
      url: 'https://x.bandcamp.com',
      imageId: null,
      location: null,
      followedAt: null,
    });

    expect(html).toContain('data-band-name="Ital &amp; &quot;Halal&quot; &lt;b&gt;"');
    expect(html).not.toContain('<b>');
    expect(html).not.toContain('<img');
  });
});

describe('FAN_PAGE_DOM following selectors', () => {
  const html = fixtureText('me-following-tab.html');

  it('find the grid, sub-tabs, containers and cards in the fixture', () => {
    expect(html).toContain('id="following-grid"');
    expect(html).toContain('id="following-tabs"');
    for (const kind of ['band', 'fan'] as const) {
      const id = FAN_PAGE_DOM.followingContainers[kind].slice(1);
      expect(html).toContain(`id="${id}"`);
    }
    expect(html).toContain('data-tab="following-bands"');
    expect(html).toContain('data-tab="following-fans"');
    expect(html).toContain('class="followeer followeer-item-container');
    expect(html).toContain('class="expand-container"');
  });
});
