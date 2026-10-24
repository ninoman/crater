// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useBandcampPlays } from './useBandcampPlays';

let container: HTMLElement;
let root: Root;
let audio: HTMLAudioElement;
let sent: { type: string; payload: unknown }[];

function Recorder() {
  useBandcampPlays('a1');
  return null;
}

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  sent = [];
  vi.stubGlobal('chrome', {
    runtime: {
      sendMessage: async (message: { type: string; payload: unknown }) => {
        sent.push(message);
        return { ok: true, data: null };
      },
    },
  });
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() => root.render(<Recorder />));
  // Bandcamp's player: an audio element in the page, its playhead moved by hand here.
  audio = document.createElement('audio');
  document.body.append(audio);
  Object.defineProperty(audio, 'paused', { value: false, writable: true });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  audio.remove();
  vi.unstubAllGlobals();
});

function playTo(seconds: number) {
  Object.defineProperty(audio, 'currentTime', { value: seconds, configurable: true });
  audio.dispatchEvent(new Event('timeupdate'));
}

it('marks the release heard once Bandcamp’s player has played it for 30 seconds', () => {
  for (let t = 0; t <= 29; t += 0.5) playTo(t);
  expect(sent).toEqual([]);

  for (let t = 29.5; t <= 32; t += 0.5) playTo(t);
  expect(sent).toEqual([{ type: 'markHeard', payload: { itemKey: 'a1', source: 'bandcamp' } }]);
});

it('doesn’t count seeking through a track as listening', () => {
  playTo(0);
  audio.dispatchEvent(new Event('seeking'));
  playTo(120);
  playTo(240);

  expect(sent).toEqual([]);
});
