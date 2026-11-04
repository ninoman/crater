import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import type { ItemKey } from '../bandcamp';
import type { HideTarget } from '../shared/hide';
import { type HeldRow, playQueue, queuePosition, withHeld } from '../shared/playQueue';
import { type ActionableRow, coveredBy } from './rowActions';
import { type PreviewPlayerView, usePreviewPlayer } from './usePreviewPlayer';

export interface ListPlayerRow extends ActionableRow {
  url: string;
}

export interface ListPlayer<R extends ListPlayerRow = ListPlayerRow> {
  /** The rows to show: the list's, with the playing one kept in place while it plays. */
  rows: readonly R[];
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
  /** Within the playing release. */
  previousTrack: () => void;
  nextTrack: () => void;
  /** A hide is about to take rows out: a playing one covered by it goes, rather than stays. */
  hidden: (target: HideTarget) => void;
}

/**
 * Plays a list's visible rows through, one release after another, in one audio element
 * (decisions §22): a cover starts the queue there, each release moves on to the next when it
 * ends, and the list's keys step through it. The playing row stays in place when a reload leaves
 * it out, so the heard mark it just got doesn't skip it under *Hide heard*. `onHeard` hears of each release played past the
 * heard threshold, which the player has already saved, so the row can show it at once.
 */
export function useListPlayer<R extends ListPlayerRow>(
  rows: readonly R[],
  onHeard: (matchKey: ItemKey) => void,
): ListPlayer<R> {
  const [queue, dispatch] = useReducer(playQueue, {
    keys: rows.map((row) => row.matchKey),
    current: null,
  });
  const current = queue.current;
  // Read while rendering, written after: where the playing row was last shown.
  const held = useRef<HeldRow<R> | null>(null);
  const shown = useMemo(() => withHeld(rows, current, held.current), [rows, current]);
  useEffect(() => {
    const index = shown.findIndex((row) => row.matchKey === current);
    const row = shown[index];
    held.current = row ? { row, index } : null;
  });
  const keyList = shown.map((row) => row.matchKey).join(' ');

  useEffect(() => {
    dispatch({ type: 'rows', keys: keyList === '' ? [] : (keyList.split(' ') as ItemKey[]) });
  }, [keyList]);

  const url = shown.find((row) => row.matchKey === current)?.url ?? null;
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
    const [first] = shown;
    if (first) dispatch({ type: 'play', key: first.matchKey });
  }, [shown]);
  const hidden = useCallback((target: HideTarget) => {
    if (held.current && coveredBy(target, held.current.row)) held.current = null;
  }, []);

  usePlayerKeys(current !== null, { toggle: player.toggle, next, previous, stop });

  return {
    rows: shown,
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
    previousTrack: player.previousTrack,
    nextTrack: player.nextTrack,
    hidden,
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
