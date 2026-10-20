import { describe, expect, it } from 'vitest';
import { formatOwnedTracks } from './formatOwnedTracks';

describe('formatOwnedTracks', () => {
  it('counts owned tracks', () => {
    expect(formatOwnedTracks(1)).toBe('you own 1 track');
    expect(formatOwnedTracks(3)).toBe('you own 3 tracks');
  });
});
