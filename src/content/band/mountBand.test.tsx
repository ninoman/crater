// @vitest-environment jsdom
// The band home page against a fake worker: tags show only for a band you follow.
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fixtureText } from '../../../tests/fixtures';
import { mountBand } from './mountBand';

let followed: number[] | null;

function stubWorker() {
  vi.stubGlobal('chrome', {
    runtime: {
      sendMessage: async (message: { type: string }) => {
        if (message.type === 'getFollowTags') return { ok: true, data: followed };
        if (message.type === 'listTags') {
          return { ok: true, data: [{ id: 1, name: 'dub', nameKey: 'dub' }] };
        }
        return { ok: false, error: `not faked: ${message.type}` };
      },
    },
  });
}

async function mountPage() {
  const doc = new DOMParser().parseFromString(fixtureText('band-page.html'), 'text/html');
  await act(async () => {
    mountBand(doc);
  });
  await act(async () => {});
  return doc.querySelector('dighead-root')?.shadowRoot?.querySelector('.dh-tag-editor') ?? null;
}

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  stubWorker();
});
afterEach(() => vi.unstubAllGlobals());

describe('mountBand', () => {
  it('shows the band’s tags when you follow it', async () => {
    followed = [1];
    expect((await mountPage())?.textContent).toContain('dub');
  });

  it('shows nothing when you do not follow it', async () => {
    followed = null;
    expect(await mountPage()).toBeNull();
  });
});
