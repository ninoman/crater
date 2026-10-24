import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import type { ItemKey } from '../bandcamp';
import { playQueue, queuePosition } from '../shared/playQueue';
import { type PreviewPlayerView, usePreviewPlayer } from './usePreviewPlayer';

export interface ListPlayerRow {
  matchKey: ItemKey;
  url: string;
}

export interface ListPlayer {
  /** The row playing, or null while stopped. */
  current: ItemKey | null;
  /** 1-based place of `current`, or null while stopped. */
  position: number | null;
  total: number;
  view: PreviewPlayerView;
  play: (matchKey: ItemKey) => void;
  playAll: () => void;
  stop: () => void;
  next: () => void;
  previous: () => void;
  toggle: () => void;
  seek: (seconds: number) => void;
}

/**
 * Plays a list's visible rows through, one release after another, in one audio element
 * (decisions §22): a cover starts the queue there, each release moves on to the next when it
 * ends, and the list's keys step through it. `onHeard` hears of each release played past the
 * heard threshold, which the player has already saved, so the row can show it at once.
 */
export function useListPlayer(
  rows: readonly ListPlayerRow[],
  onHeard: (matchKey: ItemKey) => void,
): ListPlayer {
  const keys = useMemo(() => rows.map((row) => row.matchKey), [rows]);
  const [queue, dispatch] = useReducer(playQueue, { keys, current: null });
  const keyList = keys.join(' ');

  useEffect(() => {
    dispatch({ type: 'rows', keys: keyList === '' ? [] : (keyList.split(' ') as ItemKey[]) });
  }, [keyList]);

  const current = queue.current;
  const url = rows.find((row) => row.matchKey === current)?.url ?? null;
  const heardRef = useRef(onHeard);
  useEffect(() => {
    heardRef.current = onHeard;
  });
  const player = usePreviewPlayer(url, {
    onEnded: () => dispatch({ type: 'ended' }),
    onHeard: () => {
      if (current !== null) heardRef.current(current);
    },
  });

  const play = useCallback((matchKey: ItemKey) => dispatch({ type: 'play', key: matchKey }), []);
  const stop = useCallback(() => dispatch({ type: 'stop' }), []);
  const next = useCallback(() => dispatch({ type: 'next' }), []);
  const previous = useCallback(() => dispatch({ type: 'previous' }), []);
  const playAll = useCallback(() => {
    const [first] = keys;
    if (first) dispatch({ type: 'play', key: first });
  }, [keys]);

  usePlayerKeys(current !== null, { toggle: player.toggle, next, previous, stop });

  return {
    current,
    position: queuePosition(queue),
    total: queue.keys.length,
    view: player.view,
    play,
    playAll,
    stop,
    next,
    previous,
    toggle: player.toggle,
    seek: player.seek,
  };
}

const KEYS: Record<string, 'toggle' | 'next' | 'previous' | 'stop'> = {
  k: 'toggle',
  n: 'next',
  p: 'previous',
  Escape: 'stop',
};

/**
 * K play / pause, N next, P previous, Escape stop, while the list is playing. Left alone while
 * typing or with a modifier held, so Bandcamp's search box and browser shortcuts keep working.
 */
function usePlayerKeys(
  active: boolean,
  actions: Record<'toggle' | 'next' | 'previous' | 'stop', () => void>,
): void {
  const ref = useRef(actions);
  useEffect(() => {
    ref.current = actions;
  });
  useEffect(() => {
    if (!active) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
      const action = KEYS[event.key.length === 1 ? event.key.toLowerCase() : event.key];
      if (!action || isTyping(event.composedPath()[0])) return;
      event.preventDefault();
      ref.current[action]();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [active]);
}

const NOT_TEXT = new Set(['range', 'checkbox', 'radio', 'button', 'submit', 'reset']);

function isTyping(target: EventTarget | undefined): boolean {
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true;
  if (target instanceof HTMLInputElement) return !NOT_TEXT.has(target.type);
  return target instanceof HTMLElement && target.isContentEditable;
}
