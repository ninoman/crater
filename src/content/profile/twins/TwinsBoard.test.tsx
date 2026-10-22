// @vitest-environment jsdom
// Previewing a twin's latest buys from the leaderboard.
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TwinBuy, TwinRow, TwinsResult } from '../../../shared/twins';
import { TwinsBoard } from './TwinsBoard';

const NOW = 10 * 86_400_000;

function buy(matchKey: `a${number}`): TwinBuy {
  return {
    matchKey,
    title: `Title ${matchKey}`,
    artist: 'Artist',
    url: `https://artist.bandcamp.com/album/${matchKey}`,
    coverUrl: null,
    boughtAt: NOW - 86_400_000,
  };
}

const ROW: TwinRow = {
  fanId: 10,
  rank: 1,
  username: 'fan10',
  name: 'Ten',
  avatarUrl: null,
  url: 'https://bandcamp.com/fan10',
  overlap: 3,
  jaccard: 0.1,
  score: 0.5,
  labelCluster: false,
  followed: false,
  lately: null,
  latelyOverlap: 0,
  trend: 'quiet',
  recentBuys: [buy('a1'), buy('a2')],
};

const RESULT: TwinsResult = {
  basis: 'ready',
  rows: [ROW],
  latelyRows: [],
  latelyHalfLifeMonths: 6,
  computedAt: NOW,
  fansRead: 1,
};

let container: HTMLElement;
let root: Root;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  // The preview never loads here; only which release is asked for matters.
  vi.stubGlobal('chrome', { runtime: { sendMessage: vi.fn(() => new Promise(() => {})) } });
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() => root.render(<TwinsBoard result={RESULT} now={NOW} />));
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function cover(title: string): HTMLButtonElement {
  const button = container.querySelector<HTMLButtonElement>(
    `button[aria-label="Preview Artist – ${title}"]`,
  );
  if (!button) throw new Error(`no cover for ${title}`);
  return button;
}

const nowPlaying = () => container.querySelector('[aria-label="Now previewing"]');

describe('TwinsBoard latest buys', () => {
  it('previews a cover in the player under the board, one at a time', () => {
    expect(nowPlaying()).toBeNull();

    act(() => cover('Title a1').click());
    expect(nowPlaying()?.textContent).toContain('Artist – Title a1');
    expect(nowPlaying()?.textContent).toContain('bought by Ten');
    expect(cover('Title a1').getAttribute('aria-pressed')).toBe('true');

    act(() => cover('Title a2').click());
    expect(nowPlaying()?.textContent).toContain('Title a2');
    expect(cover('Title a1').getAttribute('aria-pressed')).toBe('false');
    expect(chrome.runtime.sendMessage).toHaveBeenLastCalledWith({
      type: 'getPreview',
      payload: { url: buy('a2').url },
    });
  });

  it('stops when the playing cover is clicked again', () => {
    act(() => cover('Title a1').click());
    act(() => cover('Title a1').click());
    expect(nowPlaying()).toBeNull();
  });
});
