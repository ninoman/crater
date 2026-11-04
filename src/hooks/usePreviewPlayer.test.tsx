// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, type Mock, vi } from 'vitest';
import type { PreviewTrack } from '../bandcamp';
import { type PreviewPlayer, usePreviewPlayer } from './usePreviewPlayer';

let container: HTMLElement;
let root: Root;
let preview: HTMLAudioElement;
let bandcamp: HTMLAudioElement;
let pauseBandcamp: Mock<() => void>;
let pausePreview: Mock<() => void>;
let tracks: PreviewTrack[];
let player: PreviewPlayer;

function Player() {
  player = usePreviewPlayer('https://artist.bandcamp.com/album/one');
  return null;
}

function track(title: string): PreviewTrack {
  return { itemKey: null, title, streamUrl: `https://bcbits.test/${title}`, duration: 100 };
}

/** An audio element whose `paused` is set by hand, since jsdom doesn't play media. */
function fakeAudio(paused: boolean): HTMLAudioElement {
  const audio = document.createElement('audio');
  Object.defineProperty(audio, 'paused', { value: paused, writable: true });
  return audio;
}

async function openPreview() {
  await act(async () => root.render(<Player />));
}

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  tracks = [track('One')];
  vi.stubGlobal('chrome', {
    runtime: {
      sendMessage: async () => ({
        ok: true,
        data: {
          tracks,
          startIndex: 0,
          matchKey: 'a1',
        },
      }),
    },
  });
  preview = fakeAudio(true);
  pausePreview = vi.fn<() => void>();
  preview.pause = pausePreview;
  // A real constructor call, so `new Audio()` returns the element built here.
  vi.stubGlobal(
    'Audio',
    vi.fn(function audio() {
      return preview;
    }),
  );
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => undefined);
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);

  // Bandcamp's player: an audio element in the page.
  bandcamp = fakeAudio(false);
  pauseBandcamp = vi.fn<() => void>();
  bandcamp.pause = pauseBandcamp;
  document.body.append(bandcamp);
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  bandcamp.remove();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it('pauses Bandcamp when the preview starts playing', async () => {
  await openPreview();
  expect(pauseBandcamp).not.toHaveBeenCalled();

  act(() => {
    preview.dispatchEvent(new Event('play'));
  });
  expect(pauseBandcamp).toHaveBeenCalledOnce();
});

it('pauses the preview when Bandcamp starts playing', async () => {
  await openPreview();
  pausePreview.mockClear();

  bandcamp.dispatchEvent(new Event('play'));
  expect(pausePreview).toHaveBeenCalledOnce();
});

it('stops watching Bandcamp once closed', async () => {
  await openPreview();
  act(() => root.render(null));
  pausePreview.mockClear();

  bandcamp.dispatchEvent(new Event('play'));
  expect(pausePreview).not.toHaveBeenCalled();
});

it('leaves an already paused Bandcamp player alone', async () => {
  Object.defineProperty(bandcamp, 'paused', { value: true });
  await openPreview();

  act(() => {
    preview.dispatchEvent(new Event('play'));
  });
  expect(pauseBandcamp).not.toHaveBeenCalled();
});

it("steps between the release's tracks and stops at either end", async () => {
  tracks = [track('One'), track('Two')];
  await openPreview();
  const title = () => (player.view.state === 'ready' ? player.view.track.title : null);

  act(() => player.previousTrack());
  expect(title()).toBe('One');
  act(() => player.nextTrack());
  expect(title()).toBe('Two');
  expect(preview.src).toBe('https://bcbits.test/Two');
  act(() => player.nextTrack());
  expect(title()).toBe('Two');
  act(() => player.previousTrack());
  expect(title()).toBe('One');
});
