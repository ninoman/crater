// "Heard it" (decisions §22): which releases you've listened to, and when a play counts. Pure.

/** Where a heard mark came from: our preview player, Bandcamp's own player, or a click. */
export type HeardSource = 'preview' | 'bandcamp' | 'manual';

/** Seconds of actual listening to one release before it counts as heard. */
export const HEARD_AFTER_SECONDS = 30;

/**
 * A larger jump between two time updates is a seek, not listening. Browsers fire `timeupdate`
 * every 250 ms or so, and a busy tab can stretch that.
 */
const MAX_STEP_SECONDS = 2;

/** Listening time so far. `at` is the last playhead seen while playing, null while paused. */
export interface Listening {
  seconds: number;
  at: number | null;
}

export const NOT_LISTENING: Listening = { seconds: 0, at: null };

/** A time update while playing: adds the step since the last one, unless it was a seek. */
export function listenedTo(state: Listening, currentTime: number): Listening {
  if (state.at === null) return { ...state, at: currentTime };
  const step = currentTime - state.at;
  const seconds = step > 0 && step <= MAX_STEP_SECONDS ? state.seconds + step : state.seconds;
  return { seconds, at: currentTime };
}

/** Paused, seeking or on to another track: the next update starts a new step. */
export function stoppedListening(state: Listening): Listening {
  return { ...state, at: null };
}

/**
 * Whether a release counts as heard: 30 s of listening, or a track that just ended after at
 * least half its length was listened to, for releases of short tracks. Seeking to the end of a
 * track doesn't count.
 */
export function isHeard(state: Listening, endedTrackSeconds?: number): boolean {
  if (state.seconds >= HEARD_AFTER_SECONDS) return true;
  return (
    endedTrackSeconds !== undefined &&
    endedTrackSeconds > 0 &&
    state.seconds >= endedTrackSeconds / 2
  );
}
