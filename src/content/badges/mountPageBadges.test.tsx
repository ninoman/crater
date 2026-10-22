// @vitest-environment jsdom
// Page badges on a fan page against a fake worker: one lookup per batch, one badge per release.
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fixtureText } from '../../../tests/fixtures';
import type { ReleaseRef } from '../../shared/pageBadges';
import { startPageBadges } from './mountPageBadges';

let batches: ReleaseRef[][];

beforeEach(() => {
  batches = [];
  vi.stubGlobal('chrome', {
    runtime: {
      sendMessage: async (message: { type: string; payload: { links: ReleaseRef[] } }) => {
        if (message.type !== 'getPageBadges') return { ok: false, error: message.type };
        const { links } = message.payload;
        batches.push(links);
        // Promises is owned; everything else has 2 twins, except unknown urls.
        const data = links.map((link) => {
          if (link.url.endsWith('/unknown')) return null;
          const owned = link.itemKey === 'a3149089081';
          return { owned, wishlisted: false, twins: owned ? 0 : 2, topTwins: 30 };
        });
        return { ok: true, data };
      },
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 400)));

function badges() {
  return [...document.querySelectorAll('dighead-badge')].map((host) => ({
    after: host.previousElementSibling,
    text: host.shadowRoot?.querySelector('.dh-badge')?.textContent,
  }));
}

describe('startPageBadges', () => {
  it('badges each card once from one lookup, and new cards as they arrive', async () => {
    const page = new DOMParser().parseFromString(fixtureText('fan-page.html'), 'text/html');
    document.body.innerHTML = page.body.innerHTML;
    const stop = startPageBadges(document, 'https://bandcamp.com/jiggypol');
    await settle();

    expect(batches).toHaveLength(1);
    const placed = badges();
    const promises = placed.find(
      ({ after }) =>
        after?.getAttribute('href') === 'https://floatingpoints.bandcamp.com/album/promises',
    );
    expect(promises?.text).toBe('owned');
    expect(promises?.after?.classList.contains('item-link')).toBe(true);
    const cards = document.querySelectorAll('li.collection-item-container');
    for (const card of cards) expect(card.querySelectorAll('dighead-badge')).toHaveLength(1);
    expect(placed.filter(({ text }) => text === '2 twins').length).toBeGreaterThanOrEqual(9);

    // Infinite scroll: a new card and a link we can't identify. Only they are asked about.
    document.body.insertAdjacentHTML(
      'beforeend',
      `<ul><li><a href="https://new.bandcamp.com/album/fresh">Fresh</a></li>
       <li><a href="https://new.bandcamp.com/album/unknown">Unknown</a></li></ul>`,
    );
    await settle();
    expect(batches).toHaveLength(2);
    expect(batches[1]?.map((link) => link.url)).toEqual([
      'https://new.bandcamp.com/album/fresh',
      'https://new.bandcamp.com/album/unknown',
    ]);
    const fresh = badges().filter(({ after }) => after?.textContent === 'Fresh');
    expect(fresh.map(({ text }) => text)).toEqual(['2 twins']);
    expect(badges().some(({ after }) => after?.textContent === 'Unknown')).toBe(false);
    expect(badges()).toHaveLength(placed.length + 1);
    stop();
  });
});
