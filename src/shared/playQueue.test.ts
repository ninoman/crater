import { describe, expect, it } from 'vitest';
import type { ItemKey } from '../bandcamp';
import { type PlayQueue, type PlayQueueAction, playQueue, queuePosition } from './playQueue';

const keys: ItemKey[] = ['a1', 'a2', 'a3'];
const stopped: PlayQueue = { keys, current: null };
const run = (state: PlayQueue, ...actions: PlayQueueAction[]) => actions.reduce(playQueue, state);

describe('playQueue', () => {
  it('plays a row, then moves on when each release ends, and stops after the last', () => {
    const playing = run(stopped, { type: 'play', key: 'a2' });
    expect(playing.current).toBe('a2');
    expect(run(playing, { type: 'ended' }).current).toBe('a3');
    expect(run(playing, { type: 'ended' }, { type: 'ended' }).current).toBeNull();
  });

  it('steps next and previous, and stays put at either end', () => {
    const first = run(stopped, { type: 'play', key: 'a1' });
    expect(run(first, { type: 'previous' }).current).toBe('a1');
    expect(run(first, { type: 'next' }, { type: 'next' }).current).toBe('a3');
    expect(run(first, { type: 'next' }, { type: 'next' }, { type: 'next' }).current).toBe('a3');
    expect(run(first, { type: 'next' }, { type: 'previous' }).current).toBe('a1');
  });

  it('does nothing on next, previous or ended while stopped, or for an unknown row', () => {
    expect(run(stopped, { type: 'next' }, { type: 'previous' }, { type: 'ended' })).toEqual(
      stopped,
    );
    expect(run(stopped, { type: 'play', key: 'a9' })).toEqual(stopped);
  });

  it('stops', () => {
    expect(run(stopped, { type: 'play', key: 'a1' }, { type: 'stop' }).current).toBeNull();
  });

  it('keeps playing the same release when the list changes around it', () => {
    const playing = run(stopped, { type: 'play', key: 'a2' });
    expect(run(playing, { type: 'rows', keys: ['a0', 'a2'] })).toEqual({
      keys: ['a0', 'a2'],
      current: 'a2',
    });
  });

  it('moves on to the next row still there when the playing one leaves the list', () => {
    const playing = run(stopped, { type: 'play', key: 'a1' });
    expect(run(playing, { type: 'rows', keys: ['a3'] }).current).toBe('a3');
    expect(run(playing, { type: 'rows', keys: [] }).current).toBeNull();
  });

  it('says where it has got to', () => {
    expect(queuePosition(stopped)).toBeNull();
    expect(queuePosition(run(stopped, { type: 'play', key: 'a3' }))).toBe(3);
  });
});
