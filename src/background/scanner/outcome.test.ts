import { describe, expect, it } from 'vitest';
import { BlockedHostError, NetworkError } from '../http';
import { classifyFailure } from './outcome';

describe('classifyFailure', () => {
  it('calls no answer from bandcamp.com a network failure', () => {
    const error = new NetworkError(
      'https://a.bandcamp.com/track/x',
      new TypeError('Failed to fetch'),
    );
    expect(classifyFailure(error, 0)).toEqual({ kind: 'network' });
  });

  it('drops a job on a custom domain whose seller is unknown', () => {
    const error = new BlockedHostError(
      'https://music.example.com/track/x',
      'its seller is unknown',
    );
    expect(classifyFailure(error, 0)).toEqual({ kind: 'permanent' });
  });
});
