// @vitest-environment jsdom
// Hearts are optimistic: they show the change and open the tag picker at once, and a refusal or
// failure undoes both, including the local wishlist record.
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { type HeartTarget, useWishlistHearts } from './useWishlistHearts';

let container: HTMLElement;
let root: Root;
let latest: ReturnType<typeof useWishlistHearts>;
let sent: { type: string; payload: unknown }[];
let answerSetWishlisted: (answer: { ok: boolean; data?: unknown; error?: string }) => void;

const target: HeartTarget = {
  rowKey: 'a1',
  url: 'https://x.bandcamp.com/album/one',
  release: { itemKey: 'a1', albumKey: null },
  name: 'Artist – One',
};

function Probe() {
  latest = useWishlistHearts();
  return null;
}

beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  sent = [];
  vi.stubGlobal('chrome', {
    runtime: {
      sendMessage: (message: { type: string; payload: unknown }) => {
        sent.push(message);
        if (message.type === 'setWishlisted') {
          return new Promise((resolve) => {
            answerSetWishlisted = resolve;
          });
        }
        return Promise.resolve({ ok: true, data: message.type === 'markWishlisted' ? true : null });
      },
    },
    storage: { local: { get: async () => ({}) } },
  });
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root.render(<Probe />));
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

async function click() {
  await act(async () => latest.toggle(target, container));
}

it('fills the heart and opens the tag picker before Bandcamp answers', async () => {
  await click();

  expect(latest.heart('a1')).toEqual({ on: true, status: 'saving' });
  expect(latest.prompt).toMatchObject({ rowKey: 'a1', itemKey: 'a1' });
  expect(sent.map((message) => message.type)).toEqual(['markWishlisted', 'setWishlisted']);

  await act(async () => answerSetWishlisted({ ok: true, data: { status: 'done' } }));
  expect(latest.heart('a1')).toEqual({ on: true, status: 'idle' });
});

it('undoes the heart, the picker and the local record when Bandcamp fails', async () => {
  await click();
  await act(async () => answerSetWishlisted({ ok: false, error: 'HTTP 400' }));

  expect(latest.heart('a1')).toEqual({ on: false, status: 'error' });
  expect(latest.prompt).toBeNull();
  expect(sent.at(-1)).toEqual({ type: 'markUnwishlisted', payload: { itemKey: 'a1' } });
});

it('says signed out and puts the heart back', async () => {
  await click();
  await act(async () => answerSetWishlisted({ ok: true, data: { status: 'signed-out' } }));

  expect(latest.heart('a1')).toEqual({ on: false, status: 'signed-out' });
});

it('ignores clicks while a change is saving', async () => {
  await click();
  await click();

  expect(sent.filter((message) => message.type === 'setWishlisted')).toHaveLength(1);
});
