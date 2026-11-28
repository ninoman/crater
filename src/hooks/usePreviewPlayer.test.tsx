// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, type Mock, vi } from 'vitest';
import type { PreviewTrack } from '../bandcamp';
import {
  type PreviewPlayer,
  type PreviewPlayerOptions,
  usePreviewPlayer,
} from './usePreviewPlayer';

let container: HTMLElement;
let root: Root;
let preview: HTMLAudioElement;
let bandcamp: HTMLAudioElement;
let pauseBandcamp: Mock<() => void>;
let pausePreview: Mock<() => void>;
let tracks: PreviewTrack[];
let player: PreviewPlayer;
let storedSettings: Record<string, unknown>;
let sent: { type: string; payload: unknown }[];

function Player(options: PreviewPlayerOptions) {
  player = usePreviewPlayer('https://artist.bandcamp.com/album/one', options);
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

async function openPreview(options: PreviewPlayerOptions = {}) {
  await act(async () => root.render(<Player {...options} />));
}

/** Plays from `from` to `to` seconds in steps a browser would report. */
function playThrough(from: number, to: number) {
  act(() => {
    Object.assign(preview, { paused: false });
    preview.dispatchEvent(new Event('play'));
    for (let time = from; time <= to; time += 0.25) {
      preview.currentTime = time;
      preview.dispatchEvent(new Event('timeupdate'));
    }
  });
}

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  tracks = [track('One')];
  storedSettings = {};
  sent = [];
  vi.stubGlobal('chrome', {
    runtime: {
      sendMessage: async (message: { type: string; payload: unknown }) => {
        sent.push(message);
        return {
          ok: true,
          data: message.type === 'getPreview' ? { tracks, startIndex: 0, matchKey: 'a1' } : null,
        };
      },
    },
    storage: { local: { get: async () => ({ settings: storedSettings }) } },
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

it('starts past the intro when asked, by the saved percent', async () => {
  storedSettings = { previewStartPercent: 30 };
  await openPreview({ skipIntro: true });
  expect(preview.currentTime).toBe(30);
  expect(player.view.state === 'ready' && player.view.position).toBe(30);
});

it('plays from the start without skipIntro, whatever the setting', async () => {
  storedSettings = { previewStartPercent: 30 };
  await openPreview();
  expect(preview.currentTime).toBe(0);
});

it('counts half a track against the part that played after the intro', async () => {
  storedSettings = { previewStartPercent: 80 };
  Object.defineProperty(preview, 'duration', { value: 100 });
  await openPreview({ skipIntro: true });

  // 20 s are left after the intro: 10 s is half of that, though short of 30 s or half of 100.
  playThrough(80, 90);
  act(() => {
    preview.dispatchEvent(new Event('ended'));
  });
  await act(async () => {});
  expect(sent.some((message) => message.type === 'markHeard')).toBe(true);
});
