// @vitest-environment jsdom
// Your own fan page: Bandcamp's following, wishlist and collection tabs are taken over only
// while tags are on (decisions §31).
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fixtureText } from '../../../tests/fixtures';
import { mountProfile } from './mountProfile';

const GRIDS = ['#following-grid', '#wishlist-grid', '#collection-grid'];

async function mountPage(tagging: boolean): Promise<Document> {
  const doc = new DOMParser().parseFromString(fixtureText('me-fan-page.html'), 'text/html');
  await act(async () => mountProfile(doc, tagging));
  return doc;
}

/** Grids holding one of our roots. */
const takenOver = (doc: Document) =>
  GRIDS.filter((selector) => doc.querySelector(`${selector} crater-root`) !== null);

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  // Our profile tabs mount too; Radix measures them.
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  vi.stubGlobal('chrome', {
    storage: { local: { get: async () => ({}), set: async () => {} } },
    runtime: {
      sendMessage: async (message: { type: string }) => ({
        ok: false,
        error: `not faked: ${message.type}`,
      }),
      onMessage: { addListener: () => {}, removeListener: () => {} },
    },
  });
});
afterEach(() => vi.unstubAllGlobals());

describe('mountProfile', () => {
  it('takes over the following, wishlist and collection tabs while tags are on', async () => {
    expect(takenOver(await mountPage(true))).toEqual(GRIDS);
  });

  it('leaves all three to Bandcamp while tags are off', async () => {
    expect(takenOver(await mountPage(false))).toEqual([]);
  });
});
