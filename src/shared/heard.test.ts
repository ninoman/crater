import { describe, expect, it } from 'vitest';
import { isHeard, listenedTo, NOT_LISTENING, stoppedListening, type Listening } from './heard';

const play = (from: Listening, times: number[]) => times.reduce(listenedTo, from);

describe('listening', () => {
  it('adds up time played, step by step', () => {
    const state = play(NOT_LISTENING, [0, 0.25, 0.5, 0.75, 1]);
    expect(state.seconds).toBeCloseTo(1);
  });

  it('skips seeks, forward or back', () => {
    const state = play(NOT_LISTENING, [0, 0.25, 120, 120.25, 10, 10.25]);
    expect(state.seconds).toBeCloseTo(0.75);
  });

  it('starts a new step after a pause or a new track', () => {
    const before = play(NOT_LISTENING, [0, 1]);
    const state = play(stoppedListening(before), [200, 201]);
    expect(state.seconds).toBeCloseTo(2);
  });

  it('counts as heard after 30 s, or a short track listened to past half', () => {
    const steps = (seconds: number) => Array.from({ length: seconds + 1 }, (_, i) => i);
    expect(isHeard(play(NOT_LISTENING, steps(29)))).toBe(false);
    expect(isHeard(play(NOT_LISTENING, steps(30)))).toBe(true);
    expect(isHeard(play(NOT_LISTENING, steps(12)), 20)).toBe(true);
    // Seeking to the end of a track isn't listening to it.
    expect(isHeard(play(NOT_LISTENING, [0, 1, 19]), 20)).toBe(false);
    expect(isHeard(NOT_LISTENING, 0)).toBe(false);
  });
});
