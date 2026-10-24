// Playing a list through (decisions §22): which of the visible rows is playing, and what comes
// next. Pure; useListPlayer holds the state and the audio.

import type { ItemKey } from '../bandcamp';

export interface PlayQueue {
  /** The rows in the order shown. */
  keys: readonly ItemKey[];
  /** The release playing, or null while stopped. */
  current: ItemKey | null;
}

export type PlayQueueAction =
  /** Start, or jump to, one row: a cover clicked, or "Play all" on the first. */
  | { type: 'play'; key: ItemKey }
  | { type: 'stop' }
  | { type: 'next' }
  | { type: 'previous' }
  /** The current release played to its end: on to the next, or stop after the last. */
  | { type: 'ended' }
  /** The list changed: a hide, a reload, "Hide heard". */
  | { type: 'rows'; keys: readonly ItemKey[] };

export function playQueue(state: PlayQueue, action: PlayQueueAction): PlayQueue {
  const at = state.current === null ? -1 : state.keys.indexOf(state.current);
  switch (action.type) {
    case 'play':
      return state.keys.includes(action.key) ? { ...state, current: action.key } : state;
    case 'stop':
      return { ...state, current: null };
    case 'next':
      return at === -1 || at + 1 >= state.keys.length ? state : moveTo(state, at + 1);
    case 'previous':
      return at <= 0 ? state : moveTo(state, at - 1);
    case 'ended':
      return at === -1 ? state : { ...state, current: state.keys[at + 1] ?? null };
    case 'rows':
      return { keys: action.keys, current: carriedOver(state, action.keys) };
  }
}

function moveTo(state: PlayQueue, index: number): PlayQueue {
  return { ...state, current: state.keys[index] ?? null };
}

/**
 * The release to play in a changed list: the same one if it's still there, else the first row
 * after it that is, so hiding the playing row moves on rather than stopping.
 */
function carriedOver(state: PlayQueue, keys: readonly ItemKey[]): ItemKey | null {
  if (state.current === null) return null;
  if (keys.includes(state.current)) return state.current;
  const kept = new Set(keys);
  const after = state.keys.slice(state.keys.indexOf(state.current) + 1);
  return after.find((key) => kept.has(key)) ?? null;
}

/** 1-based place of the current release, or null while stopped. */
export function queuePosition(state: PlayQueue): number | null {
  return state.current === null ? null : state.keys.indexOf(state.current) + 1;
}
