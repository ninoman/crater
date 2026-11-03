// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { ItemKey } from '../bandcamp';
import { type ListPlayer, type ListPlayerRow, useListPlayer } from './useListPlayer';

let container: HTMLElement;
let root: Root;
let player: ListPlayer;

const row = (matchKey: ItemKey): ListPlayerRow => ({
  matchKey,
  url: `https://artist.bandcamp.com/album/${matchKey}`,
  heard: false,
  hide: { band: null, label: null },
});
const [a1, a2, a3] = (['a1', 'a2', 'a3'] as const).map(row) as [
  ListPlayerRow,
  ListPlayerRow,
  ListPlayerRow,
];

function List({ rows }: { rows: ListPlayerRow[] }) {
  player = useListPlayer(rows, () => undefined);
  return null;
}

const show = (rows: ListPlayerRow[]) => act(async () => root.render(<List rows={rows} />));
const shownKeys = () => player.rows.map((r) => r.matchKey);

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.stubGlobal('chrome', {
    runtime: {
      sendMessage: async () => ({
        ok: true,
        data: {
          tracks: [{ title: 'One', streamUrl: 'https://bcbits.test/1', duration: 100 }],
          startIndex: 0,
          matchKey: 'a2',
        },
      }),
    },
  });
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => undefined);
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
  container = document.createElement('div');
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it('keeps the playing release in place when a reload leaves it out (Hide heard)', async () => {
  await show([a1, a2, a3]);
  await act(async () => player.play('a2'));
  await show([a1, a3]);
  expect(player.current).toBe('a2');
  expect(shownKeys()).toEqual(['a1', 'a2', 'a3']);
  expect(player.position).toBe(2);

  // Once something else plays, the held row goes with the next reload.
  await act(async () => player.next());
  await show([a1, a3]);
  expect(player.current).toBe('a3');
  expect(shownKeys()).toEqual(['a1', 'a3']);
});

it('moves on when the playing release is hidden', async () => {
  await show([a1, a2, a3]);
  await act(async () => player.play('a2'));
  await act(async () => player.hidden({ kind: 'release', matchKey: 'a2' }));
  await show([a1, a3]);
  expect(player.current).toBe('a3');
  expect(shownKeys()).toEqual(['a1', 'a3']);
});
