import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fixtureJson, fixtureText } from '../../tests/fixtures';
import { type FetchJson, type FetchText, parseReleasePage } from '../bandcamp';
import { CraterDb } from '../db';
import { cartHandlers } from './cartHandlers';
import { cartKeys } from './cartStore';

// The Origin rule needs Chrome's declarativeNetRequest.
vi.mock('./sessionOrigin', () => ({ ensureSessionOrigin: async () => {} }));

const sender = {} as chrome.runtime.MessageSender;
const ALBUM = fixtureText('album-page.html');
const URL = 'https://floatingpoints.bandcamp.com/album/promises';
const album = parseReleasePage(ALBUM).item;

let db: CraterDb;

beforeEach(async () => {
  const session = new Map<string, unknown>();
  vi.stubGlobal('chrome', {
    storage: {
      session: {
        get: async (key: string) => (session.has(key) ? { [key]: session.get(key) } : {}),
        set: async (items: Record<string, unknown>) => {
          for (const [key, value] of Object.entries(items)) session.set(key, value);
        },
      },
    },
  });
  db = new CraterDb(`test-${crypto.randomUUID()}`);
  await db.open();
});

afterEach(async () => {
  vi.unstubAllGlobals();
  await db.delete();
});

describe('cart handlers', () => {
  it('keeps the cart a page shows, so lists can leave it out', async () => {
    const h = cartHandlers(db, vi.fn<FetchJson>(), vi.fn<FetchText>());

    await h.cartSeen({ cart: { syncNum: 3, items: [{ lineId: 1, itemKey: 'a9' }] } }, sender);

    expect([...(await cartKeys())]).toEqual(['a9']);
  });

  it('keeps the cart as it stands after an add', async () => {
    const fetchJson = vi.fn<FetchJson>(async () => fixtureJson('cart_cb-add.json'));
    const h = cartHandlers(
      db,
      fetchJson,
      vi.fn<FetchText>(async () => ALBUM),
    );

    expect(await h.setInCart({ url: URL, itemKey: album.itemKey, inCart: true }, sender)).toEqual({
      status: 'done',
    });
    expect([...(await cartKeys())]).toEqual([album.itemKey]);
  });

  it('is empty before any page has shown the cart', async () => {
    expect((await cartKeys()).size).toBe(0);
  });
});
