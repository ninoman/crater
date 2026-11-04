// @vitest-environment jsdom
// Scan-progress refreshes wait for the request in flight instead of superseding it.
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { ForYouResult } from '../shared/forYou';
import { useForYou } from './useForYou';

let container: HTMLElement;
let root: Root;
let latest: ReturnType<typeof useForYou>;
let answers: ((result: ForYouResult) => void)[];

const empty: ForYouResult = { basis: 'ready', rows: [], limit: 20, crateMatesUsed: 3 };

function Probe() {
  latest = useForYou('all', false);
  return null;
}

beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  answers = [];
  vi.stubGlobal('chrome', {
    runtime: {
      sendMessage: () =>
        new Promise((resolve) => {
          answers.push((data) => resolve({ ok: true, data }));
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

it('shows a slow answer though refreshes came in while it was asked', async () => {
  act(() => latest.refresh());
  act(() => latest.refresh());
  expect(answers).toHaveLength(1);

  await act(async () => answers[0]?.(empty));
  expect(latest.view.state).toBe('ready');
  // The refreshes collapse into one more request, sent once the first answered.
  expect(answers).toHaveLength(2);
});

it('asks at once on a refresh when nothing is in flight', async () => {
  await act(async () => answers[0]?.(empty));
  act(() => latest.refresh());
  expect(answers).toHaveLength(2);
});

it('lets a reload supersede the request in flight', async () => {
  act(() => latest.reload());
  expect(answers).toHaveLength(2);

  await act(async () => answers[0]?.({ ...empty, crateMatesUsed: 1 }));
  expect(latest.view.state).toBe('loading');
  await act(async () => answers[1]?.(empty));
  expect(latest.view.state === 'ready' && latest.view.result.crateMatesUsed).toBe(3);
});
