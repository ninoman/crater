import { describe, expect, it } from 'vitest';
import { tabFromHash, withoutHash } from './hash';

const IDS = ['twins', 'for-you'] as const;

describe('tabFromHash', () => {
  it('finds a tab with or without the leading #', () => {
    expect(tabFromHash('#twins', IDS)).toBe('twins');
    expect(tabFromHash('for-you', IDS)).toBe('for-you');
  });

  it('is null for no hash or a hash that is not ours', () => {
    expect(tabFromHash('', IDS)).toBeNull();
    expect(tabFromHash('#', IDS)).toBeNull();
    expect(tabFromHash('#wishlist', IDS)).toBeNull();
    expect(tabFromHash('#Twins', IDS)).toBeNull();
    expect(tabFromHash('#twins/extra', IDS)).toBeNull();
  });
});

describe('withoutHash', () => {
  it('drops the hash and keeps path and query', () => {
    expect(withoutHash('https://bandcamp.com/me?from=x#twins')).toBe(
      'https://bandcamp.com/me?from=x',
    );
    expect(withoutHash('https://bandcamp.com/me')).toBe('https://bandcamp.com/me');
  });
});
