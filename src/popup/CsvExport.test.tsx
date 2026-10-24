// @vitest-environment jsdom
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ForYouRow } from '../shared/forYou';
import type { ListedItem } from '../shared/itemList';
import { CsvExport } from './CsvExport';

const item: ListedItem = {
  itemKey: 'a1',
  title: 'Untrue',
  artist: 'Burial',
  label: null,
  url: 'https://x.bandcamp.com/album/untrue',
  coverUrl: null,
  addedAt: Date.UTC(2026, 9, 3),
  tagIds: [1],
  note: { text: 'loud', rating: 4 },
  price: { amount: 9, currency: 'USD', purchasable: true },
  crateMateOwners: 2,
  crateMateScore: 1,
};
const pick: ForYouRow = {
  matchKey: 'a5',
  title: 'Promises',
  artist: 'Floating Points',
  label: null,
  url: 'https://x.bandcamp.com/album/promises',
  coverUrl: null,
  crateMates: 3,
  heard: false,
  hide: { band: null, label: null },
  supporters: 90,
  bestCrateMateRank: 1,
  lastBoughtAt: null,
  followed: null,
};

let lists: Record<string, ListedItem[]>;
let forYou: ForYouRow[];
let saved: { name: string; text: Promise<string> }[];
let requests: { type: string; payload: unknown }[];
let host: HTMLElement;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  lists = { wishlist: [item], collection: [] };
  forYou = [pick];
  saved = [];
  requests = [];
  vi.stubGlobal('chrome', {
    runtime: {
      sendMessage: async (message: { type: string; payload: Record<string, unknown> }) => {
        requests.push(message);
        switch (message.type) {
          case 'listItems':
            return { ok: true, data: lists[message.payload.source as string] };
          case 'listTags':
            return { ok: true, data: [{ id: 1, name: 'dub', nameKey: 'dub' }] };
          case 'getForYou':
            return { ok: true, data: { basis: 'ok', rows: forYou, crateMatesUsed: 3 } };
          default:
            return { ok: false, error: `not faked: ${message.type}` };
        }
      },
    },
  });
  URL.createObjectURL = (blob: Blob) => {
    saved.push({ name: '', text: blob.text() });
    return 'blob:x';
  };
  URL.revokeObjectURL = () => undefined;
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    const last = saved.at(-1);
    if (last) last.name = this.download;
  });
  host = document.body.appendChild(document.createElement('div'));
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  host.remove();
});

async function render(): Promise<void> {
  await act(async () => createRoot(host).render(<CsvExport />));
}

async function press(label: string): Promise<void> {
  const button = [...host.querySelectorAll('button')].find((b) => b.textContent === label);
  await act(async () => button?.click());
  await act(async () => undefined);
}

describe('the CSV export in the popup', () => {
  it('downloads the wishlist with your tag names, rating and note', async () => {
    await render();

    await press('Wishlist');

    expect(saved[0]?.name).toMatch(/^dighead-wishlist-\d{4}-\d{2}-\d{2}\.csv$/);
    const text = await saved[0]?.text;
    expect(text).toContain(
      'Burial,Untrue,,https://x.bandcamp.com/album/untrue,2026-10-03,9,USD,yes,2,dub,4,loud',
    );
    expect(host.textContent).toContain('Exported 1 row from your wishlist');
  });

  it('says so instead of saving an empty file', async () => {
    await render();

    await press('Collection');

    expect(saved).toHaveLength(0);
    expect(host.textContent).toContain('Your collection has nothing to export yet');
  });

  it('exports the For you picks of the chosen mode', async () => {
    await render();
    const select = host.querySelector('select') as HTMLSelectElement;
    await act(async () => {
      select.value = 'fresh';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });

    await press('For you');

    expect(requests.find((r) => r.type === 'getForYou')?.payload).toEqual({ mode: 'fresh', hideHeard: false });
    expect(saved[0]?.name).toMatch(/^dighead-for-you-/);
    expect(await saved[0]?.text).toContain('1,Floating Points,Promises');
  });

  it('shows an error when the worker does not answer', async () => {
    vi.stubGlobal('chrome', {
      runtime: { sendMessage: async () => ({ ok: false, error: 'down' }) },
    });
    await render();

    await press('Wishlist');

    expect(host.textContent).toContain('down');
  });
});
