// @vitest-environment jsdom
// Re-scores keep Also bought's rows in place until the new order is asked for.
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { ItemKey } from '../bandcamp';
import type { AlsoBoughtResult, AlsoBoughtRow } from '../shared/alsoBought';
import { useAlsoBought } from './useAlsoBought';

let container: HTMLElement;
let root: Root;
let listener: (message: unknown) => void;
let latest: ReturnType<typeof useAlsoBought>;

function result(...keys: ItemKey[]): AlsoBoughtResult {
  const rows = keys.map(
    (matchKey): AlsoBoughtRow => ({
      matchKey,
      title: matchKey,
      artist: 'Artist',
      label: null,
      url: '',
      coverUrl: null,
      reason: { kind: 'same-artist' },
      followed: null,
      heard: false,
      hide: { band: null, label: null },
    }),
  );
  return { releaseKey: 'a1', rows, warmup: null };
}

function Probe() {
  latest = useAlsoBought('a1', true, false);
  return null;
}

const shown = () =>
  (latest.view.state === 'ready' ? latest.view.result.rows : []).map((r) => r.matchKey);

beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.stubGlobal('chrome', {
    runtime: {
      sendMessage: async () => ({ ok: true, data: result('a2', 'a3') }),
      onMessage: {
        addListener: (handle: (message: unknown) => void) => {
          listener = handle;
        },
        removeListener: () => {},
      },
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

it('keeps the shown order through a re-score and applies the new one on reorder', () => {
  expect(shown()).toEqual(['a2', 'a3']);
  expect(latest.reorder).toBeNull();

  act(() => listener({ event: 'alsoBought', payload: result('a4', 'a3', 'a2') }));
  expect(shown()).toEqual(['a2', 'a3', 'a4']);

  act(() => latest.reorder?.());
  expect(shown()).toEqual(['a4', 'a3', 'a2']);
  expect(latest.reorder).toBeNull();
});
