import { describe, expect, it } from 'vitest';
import { badgeText } from './badgeText';

const none = { owned: false, wishlisted: false, twins: 0, topTwins: 30 };

describe('badgeText', () => {
  it('says owned alone when you own it', () => {
    expect(badgeText({ ...none, owned: true, twins: 4 })).toEqual({
      label: 'owned',
      hint: 'In your collection',
    });
  });

  it('counts twins, singular and plural', () => {
    expect(badgeText({ ...none, twins: 1 })?.label).toBe('1 twin');
    expect(badgeText({ ...none, twins: 6 })).toEqual({
      label: '6 twins',
      hint: '6 of your top 30 twins own this',
    });
  });

  it('joins wishlist and twins', () => {
    expect(badgeText({ ...none, wishlisted: true })?.label).toBe('wishlist');
    expect(badgeText({ ...none, wishlisted: true, twins: 2 })).toEqual({
      label: 'wishlist · 2 twins',
      hint: 'In your wishlist. 2 of your top 30 twins own this',
    });
  });

  it('says nothing when there is nothing to say', () => {
    expect(badgeText(none)).toBeNull();
  });
});
