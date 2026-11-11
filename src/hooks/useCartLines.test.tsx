// @vitest-environment jsdom
// Cart buttons are optimistic: they show the change at once and go back on failure.
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useCartLines } from './useCartLines';

let container: HTMLElement;
let root: Root;
let latest: ReturnType<typeof useCartLines>;
let answer: (result: { ok: boolean; data?: unknown; error?: string }) => void;
const URL = 'https://x.bandcamp.com/album/one';

function Probe() {
  latest = useCartLines();
  return null;
}

beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.stubGlobal('chrome', {
    runtime: {
      sendMessage: () =>
        new Promise((resolve) => {
          answer = resolve;
        }),
    },
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

it('shows the release in the cart at once, and keeps it there once added', async () => {
  act(() => latest.toggle('a1', URL));
  expect(latest.line('a1')).toEqual({ inCart: true, status: 'saving' });

  await act(async () => answer({ ok: true, data: { status: 'done' } }));
  expect(latest.line('a1')).toEqual({ inCart: true, status: 'idle' });
});

it('takes it out on a second click', async () => {
  act(() => latest.toggle('a1', URL));
  await act(async () => answer({ ok: true, data: { status: 'done' } }));
  act(() => latest.toggle('a1', URL));

  expect(latest.line('a1')).toEqual({ inCart: false, status: 'saving' });
});

it('goes back when Bandcamp fails', async () => {
  act(() => latest.toggle('a1', URL));
  await act(async () => answer({ ok: false, error: 'cart/cb: API returned an error' }));

  expect(latest.line('a1')).toEqual({ inCart: false, status: 'error' });
});

it('opens the page of a release with nothing to pay', async () => {
  const open = vi.spyOn(window, 'open').mockReturnValue(null);
  act(() => latest.toggle('a1', URL));
  await act(async () => answer({ ok: true, data: { status: 'free', url: URL } }));

  expect(latest.line('a1')).toEqual({ inCart: false, status: 'idle' });
  expect(open).toHaveBeenCalledWith(URL, '_blank', 'noopener');
});
