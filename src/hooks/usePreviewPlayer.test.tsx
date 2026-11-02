// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, type Mock, vi } from 'vitest';
import { usePreviewPlayer } from './usePreviewPlayer';

let container: HTMLElement;
let root: Root;
let preview: HTMLAudioElement;
let bandcamp: HTMLAudioElement;
let pauseBandcamp: Mock<() => void>;
let pausePreview: Mock<() => void>;

function Player() {
  usePreviewPlayer('https://artist.bandcamp.com/album/one');
  return null;
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
  vi.stubGlobal('chrome', {
    runtime: {
      sendMessage: async () => ({
        ok: true,
        data: {
          tracks: [{ title: 'One', streamUrl: 'https://bcbits.test/1', duration: 100 }],
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
