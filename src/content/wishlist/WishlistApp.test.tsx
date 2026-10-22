// @vitest-environment jsdom
// The whole wishlist tab against a fake worker: takeover on first open, rows with their tags,
// filtering, bulk tagging and the empty state.
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fixtureText } from '../../../tests/fixtures';
import { flushObservers } from '../../../tests/followingTabDom';
import type { Tag } from '../../shared/following';
import type { SyncStatus } from '../../shared/sync';
import type { WishlistItem } from '../../shared/wishlist';
import { mountWishlist } from './mountWishlist';

const TAGS: Tag[] = [
  { id: 1, name: 'dub', nameKey: 'dub' },
  { id: 2, name: 'techno', nameKey: 'techno' },
];
let items: WishlistItem[];
const assigned: unknown[] = [];

function wish(n: number, tagIds: number[]): WishlistItem {
  return {
    itemKey: `a${n}`,
    title: `Title ${n}`,
    artist: `Artist ${n}`,
    url: `https://artist${n}.bandcamp.com/album/x`,
    coverUrl: null,
    addedAt: n * 1000,
    tagIds,
  };
}

const SYNCED: SyncStatus = {
  state: 'known',
  username: 'me',
  owned: 0,
  wishlisted: 0,
  followed: 0,
  syncedAt: 1,
  activity: { state: 'idle' },
};

/** Answers the messages the tab sends, like the worker would. */
function answer(message: { type: string; payload: Record<string, unknown> }): unknown {
  switch (message.type) {
    case 'listWishlist':
      return items;
    case 'listTags':
      return TAGS;
    case 'getSyncStatus':
      return SYNCED;
    case 'assignItemTag':
      assigned.push(message.payload);
      return 1;
    default:
      throw new Error(`not faked: ${message.type}`);
  }
}

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  items = [wish(3, [1, 2]), wish(2, [1]), wish(1, [])];
  assigned.length = 0;
  vi.stubGlobal('chrome', {
    runtime: {
      sendMessage: async (message: { type: string; payload: Record<string, unknown> }) => {
        try {
          return { ok: true, data: answer(message) };
        } catch (error) {
          return { ok: false, error: String(error) };
        }
      },
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Your own fan page, logged in, with the wishlist tab closed as it loads. */
function fanPage(): Document {
  const page = new DOMParser().parseFromString(fixtureText('me-fan-page.html'), 'text/html');
  document.head.innerHTML = page.head.innerHTML;
  document.body.innerHTML = page.body.innerHTML;
  return document;
}

async function settle(): Promise<void> {
  await act(async () => {
    await flushObservers();
    await flushObservers();
  });
}

const grid = (doc: Document) => doc.getElementById('wishlist-grid') as HTMLElement;
const root = (doc: Document) => doc.querySelector('#wishlist-items dighead-wishlist')?.shadowRoot;
const rows = (doc: Document) => [...(root(doc)?.querySelectorAll('li.dh-row') ?? [])];
const buttonNamed = (doc: Document, text: string) =>
  [...(root(doc)?.querySelectorAll('button') ?? [])].find(
    (button) => button.textContent === text,
  ) as HTMLButtonElement | undefined;

async function openTab(doc: Document): Promise<void> {
  await act(async () => mountWishlist(doc));
  grid(doc).classList.add('active');
  await settle();
}

describe('the wishlist tab', () => {
  it('leaves the tab alone until it opens', async () => {
    const doc = fanPage();
    await act(async () => mountWishlist(doc));
    await settle();
    expect(root(doc)).toBeUndefined();
  });

  it('takes over Bandcamp’s list and shows every release with its tags', async () => {
    const doc = fanPage();
    await openTab(doc);

    expect(doc.getElementById('wishlist-items')?.classList).toContain('dighead-wishlist-taken');
    expect(rows(doc).map((row) => row.querySelector('.dh-row__title')?.textContent)).toEqual([
      'Title 3',
      'Title 2',
      'Title 1',
    ]);
    const chips = [...(rows(doc)[0]?.querySelectorAll('.dh-tag-editor .dh-chip') ?? [])];
    expect(chips.map((chip) => chip.textContent)).toEqual(['dub', 'techno']);
  });

  it('filters by tag, then clears a search that matches nothing', async () => {
    const doc = fanPage();
    await openTab(doc);

    const techno = [...(root(doc)?.querySelectorAll('button[aria-pressed]') ?? [])].find(
      (button) => button.textContent === 'techno' && button.closest('.dh-tag-bar__tags'),
    ) as HTMLButtonElement | undefined;
    await act(async () => techno?.click());
    expect(rows(doc)).toHaveLength(1);
    expect(root(doc)?.textContent).toContain('Showing 1 of 3');

    const search = root(doc)?.querySelector('input[type="search"]') as HTMLInputElement;
    await act(async () => {
      const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setValue?.call(search, 'no such release');
      search.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(rows(doc)).toHaveLength(0);
    expect(root(doc)?.textContent).toContain('No releases match these filters');
    await act(async () => buttonNamed(doc, 'Clear filters')?.click());
    expect(rows(doc)).toHaveLength(3);
  });

  it('shows the bulk bar for checked releases', async () => {
    const doc = fanPage();
    await openTab(doc);

    const boxes = rows(doc).map(
      (row) => row.querySelector('button[role="checkbox"]') as HTMLButtonElement,
    );
    await act(async () => boxes[0]?.click());
    await act(async () => boxes[1]?.click());

    expect(root(doc)?.querySelector('.dh-bulk-bar')?.textContent).toContain('2 selected');
  });

  it('untags a release from its chip', async () => {
    const doc = fanPage();
    await openTab(doc);

    const remove = rows(doc)[1]?.querySelector(
      '.dh-tag-editor .dh-chip button',
    ) as HTMLButtonElement | null;
    await act(async () => remove?.click());
    await settle();

    expect(assigned).toEqual([{ tagId: 1, itemKeys: ['a2'], action: 'remove' }]);
  });

  it('says so when a synced wishlist is empty, and hides Bandcamp’s list', async () => {
    items = [];
    const doc = fanPage();
    await openTab(doc);
    await settle();

    expect(root(doc)?.textContent).toContain('Your wishlist is empty');
    expect(doc.getElementById('wishlist-items')?.classList).toContain('dighead-wishlist-taken');
  });
});
