// @vitest-environment jsdom
// The whole wishlist and collection tabs against a fake worker: takeover on first open, cards
// with their tags, filtering, bulk tagging and the empty state.
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fixtureText } from '../../../tests/fixtures';
import { flushObservers } from '../../../tests/followingTabDom';
import type { Tag } from '../../shared/following';
import type { SyncStatus, SyncStep } from '../../shared/sync';
import type { ListedItem } from '../../shared/itemList';
import { notifyFollowingChanged } from '../../hooks/followingChanges';
import { mountItemList } from './mountItemList';
import { COLLECTION, WISHLIST } from './lists';

const TAGS: Tag[] = [
  { id: 1, name: 'dub', nameKey: 'dub' },
  { id: 2, name: 'techno', nameKey: 'techno' },
];
let items: ListedItem[];
let collection: ListedItem[];
let status: SyncStatus;
let stored: Record<string, unknown>;
const assigned: unknown[] = [];

function wish(n: number, tagIds: number[], extra: Partial<ListedItem> = {}): ListedItem {
  return {
    itemKey: `a${n}`,
    title: `Title ${n}`,
    artist: `Artist ${n}`,
    label: null,
    url: `https://artist${n}.bandcamp.com/album/x`,
    coverUrl: null,
    addedAt: n * 1000,
    tagIds,
    crateMateOwners: 0,
    heard: false,
    ...extra,
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
    case 'listItems':
      return message.payload.source === 'wishlist' ? items : collection;
    case 'listTags':
      return TAGS;
    case 'getSyncStatus':
      return status;
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
  status = SYNCED;
  collection = [];
  stored = {};
  assigned.length = 0;
  vi.stubGlobal('chrome', {
    storage: {
      local: {
        get: async (key: string) => (key in stored ? { [key]: stored[key] } : {}),
        set: async (values: Record<string, unknown>) => void Object.assign(stored, values),
      },
    },
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
const root = (doc: Document) => doc.querySelector('#wishlist-items crater-wishlist')?.shadowRoot;
const collectionRoot = (doc: Document) =>
  doc.querySelector('#collection-items crater-collection')?.shadowRoot;
const cards = (doc: Document) => [...(root(doc)?.querySelectorAll('li.dh-card') ?? [])];
const buttonNamed = (doc: Document, text: string) =>
  [...(root(doc)?.querySelectorAll('button') ?? [])].find(
    (button) => button.textContent === text,
  ) as HTMLButtonElement | undefined;

/** Waits out one sync-status poll (every second) and what it triggers. */
async function nextPoll(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 1050));
  });
  await settle();
}

/** A first sync on `step`, with `wishlisted` items in the wishlist so far. */
function syncing(step: SyncStep, wishlisted: number): SyncStatus {
  return {
    state: 'known',
    username: 'me',
    owned: 0,
    followed: 0,
    wishlisted,
    syncedAt: null,
    activity: {
      state: 'syncing',
      mode: 'full',
      step,
      itemsFetched: wishlisted,
      followingFetched: 0,
    },
  };
}

async function openTab(doc: Document): Promise<void> {
  await act(async () => mountItemList(doc, WISHLIST));
  grid(doc).classList.add('active');
  await settle();
}

describe('the wishlist tab', () => {
  it('leaves the tab alone until it opens', async () => {
    const doc = fanPage();
    await act(async () => mountItemList(doc, WISHLIST));
    await settle();
    expect(root(doc)).toBeUndefined();
  });

  it('takes over Bandcamp’s list and shows every release with its tags', async () => {
    const doc = fanPage();
    await openTab(doc);

    expect(doc.getElementById('wishlist-items')?.classList).toContain('crater-wishlist-taken');
    // Ours is the only search: Bandcamp's covers just its hidden pages.
    const search = doc.getElementById('wishlist-search') as HTMLElement;
    expect(getComputedStyle(search).display).toBe('none');
    expect(cards(doc).map((row) => row.querySelector('.dh-card__title')?.textContent)).toEqual([
      'Title 3',
      'Title 2',
      'Title 1',
    ]);
    const chips = [...(cards(doc)[0]?.querySelectorAll('.dh-tag-editor .dh-chip') ?? [])];
    expect(chips.map((chip) => chip.textContent)).toEqual(['dub', 'techno']);
  });

  it('filters by tag, then clears a search that matches nothing', async () => {
    const doc = fanPage();
    await openTab(doc);

    const techno = [...(root(doc)?.querySelectorAll('button[aria-pressed]') ?? [])].find(
      (button) => button.textContent === 'techno' && button.closest('.dh-tag-bar__tags'),
    ) as HTMLButtonElement | undefined;
    await act(async () => techno?.click());
    expect(cards(doc)).toHaveLength(1);
    expect(root(doc)?.textContent).toContain('Showing 1 of 3');

    const search = root(doc)?.querySelector('input[type="search"]') as HTMLInputElement;
    await act(async () => {
      const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setValue?.call(search, 'no such release');
      search.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(cards(doc)).toHaveLength(0);
    expect(root(doc)?.textContent).toContain('No releases match these filters');
    await act(async () => buttonNamed(doc, 'Clear filters')?.click());
    expect(cards(doc)).toHaveLength(3);
  });

  it('shows the bulk bar for checked releases', async () => {
    const doc = fanPage();
    await openTab(doc);

    const boxes = cards(doc).map(
      (row) => row.querySelector('button[role="checkbox"]') as HTMLButtonElement,
    );
    await act(async () => boxes[0]?.click());
    await act(async () => boxes[1]?.click());

    expect(root(doc)?.querySelector('.dh-bulk-bar')?.textContent).toContain('2 selected');
  });

  it('docks the open preview at the bottom of the window, not under its card', async () => {
    const doc = fanPage();
    await openTab(doc);

    const cover = cards(doc)[1]?.querySelector('.dh-playable-cover') as HTMLButtonElement;
    await act(async () => cover.click());

    const player = root(doc)?.querySelector('.dh-dock .dh-now-playing');
    expect(player?.textContent).toContain('Artist 2 – Title 2');
    expect(cards(doc)[1]?.querySelector('.dh-player')).toBeNull();

    const stop = player?.querySelector('button[aria-label="Stop preview"]') as HTMLButtonElement;
    await act(async () => stop.click());
    expect(root(doc)?.querySelector('.dh-now-playing')).toBeNull();
  });

  it('untags a release from its chip', async () => {
    const doc = fanPage();
    await openTab(doc);

    const remove = cards(doc)[1]?.querySelector(
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
    expect(doc.getElementById('wishlist-items')?.classList).toContain('crater-wishlist-taken');
  });

  it('shows the wishlist while it syncs, and adds pages as they arrive', async () => {
    items = [];
    status = syncing('wishlist', 0);
    const doc = fanPage();
    await openTab(doc);
    expect(root(doc)?.textContent).toContain('Syncing your collection and wishlist');

    items = [wish(2, []), wish(1, [])];
    status = syncing('wishlist', 2);
    await nextPoll();
    expect(cards(doc)).toHaveLength(2);
    expect(root(doc)?.textContent).toContain('Still syncing your wishlist: 2 releases so far');
    expect(doc.getElementById('wishlist-items')?.classList).toContain('crater-wishlist-taken');

    items = [wish(3, []), ...items];
    status = syncing('wishlist', 3);
    await nextPoll();
    expect(cards(doc)).toHaveLength(3);

    // On to the collection: the wishlist is complete.
    status = syncing('collection', 3);
    await nextPoll();
    expect(root(doc)?.textContent).not.toContain('Still syncing');
  });

  it('shows a changed card after the list reloads', async () => {
    const doc = fanPage();
    await openTab(doc);

    items = items.map((item) => (item.itemKey === 'a2' ? { ...item, tagIds: [] } : item));
    await act(async () => notifyFollowingChanged());
    await settle();

    expect(cards(doc)[1]?.querySelectorAll('.dh-tag-editor .dh-chip')).toHaveLength(0);
    expect(cards(doc)[0]?.querySelectorAll('.dh-tag-editor .dh-chip')).toHaveLength(2);
  });

  // Renders 240 cards in jsdom: ~2 s locally, past the 5 s default on CI runners.
  it('renders a long wishlist a page at a time', async () => {
    items = Array.from({ length: 300 }, (_, n) => wish(300 - n, []));
    const doc = fanPage();
    await openTab(doc);

    expect(cards(doc)).toHaveLength(120);
    const more = [...(root(doc)?.querySelectorAll('button') ?? [])].find((button) =>
      button.textContent?.startsWith('Show more'),
    );
    expect(more?.textContent).toBe('Show more (180 left)');
    await act(async () => more?.click());
    expect(cards(doc)).toHaveLength(240);
  }, 20_000);

  it('marks heard releases with a badge and a dimmed cover', async () => {
    items = [wish(1, [], { heard: true }), wish(2, [])];
    const doc = fanPage();
    await openTab(doc);

    const card = (title: string) => cards(doc).find((li) => li.textContent?.includes(title));
    const heard = card('Title 1');
    const fresh = card('Title 2');
    expect(heard?.querySelector('.dh-heard-badge')).not.toBeNull();
    expect(heard?.querySelector('.dh-cover--dimmed')).not.toBeNull();
    expect(fresh?.querySelector('.dh-heard-badge')).toBeNull();
  });
});

describe('the collection tab', () => {
  const colCards = (doc: Document) => [
    ...(collectionRoot(doc)?.querySelectorAll('li.dh-card') ?? []),
  ];

  it('is taken over at once, since Bandcamp opens it first, and hides both of its lists', async () => {
    collection = [wish(2, []), wish(1, [])];
    const doc = fanPage();
    await act(async () => mountItemList(doc, COLLECTION));
    await settle();

    expect(colCards(doc)).toHaveLength(2);
    expect(doc.getElementById('collection-items')?.classList).toContain('crater-collection-taken');
    const native = doc.querySelectorAll(
      '#collection-items > ol.collection-grid, #collection-items > .expand-container',
    );
    expect(native.length).toBeGreaterThan(1);
    for (const element of native) expect(getComputedStyle(element).display).toBe('none');
    expect(
      collectionRoot(doc)?.querySelector('[aria-label="Crater: your collection"]'),
    ).not.toBeNull();
  });

  it('says bought on its cards', async () => {
    collection = [wish(1, [], { label: 'Hessle' })];
    const doc = fanPage();
    await act(async () => mountItemList(doc, COLLECTION));
    await settle();

    expect(colCards(doc)[0]?.textContent).toContain('bought 1 Jan 1970');
  });

  it('shows Bandcamp’s collection again when your sync has not finished', async () => {
    collection = [];
    status = syncing('collection', 0);
    const doc = fanPage();
    await act(async () => mountItemList(doc, COLLECTION));
    await settle();

    expect(collectionRoot(doc)?.textContent).toContain('Syncing your collection and wishlist');
    expect(doc.getElementById('collection-items')?.classList).not.toContain(
      'crater-collection-taken',
    );
  });

  it('says the collection is empty once synced', async () => {
    collection = [];
    const doc = fanPage();
    await act(async () => mountItemList(doc, COLLECTION));
    await settle();

    expect(collectionRoot(doc)?.textContent).toContain('Your collection is empty');
  });
});
