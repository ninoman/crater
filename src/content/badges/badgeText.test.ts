import { describe, expect, it } from 'vitest';
import { badgeText } from './badgeText';

const none = { owned: false, wishlisted: false, crateMates: 0, topCrateMates: 30 };

describe('badgeText', () => {
  it('says owned alone when you own it', () => {
    expect(badgeText({ ...none, owned: true, crateMates: 4 })).toEqual({
      label: 'owned',
      hint: 'In your collection',
    });
  });

  it('counts crate mates, singular and plural', () => {
    expect(badgeText({ ...none, crateMates: 1 })?.label).toBe('1 crate mate');
    expect(badgeText({ ...none, crateMates: 6 })).toEqual({
      label: '6 crate mates',
      hint: '6 of your top 30 crate mates own this',
    });
  });

  it('joins wishlist and crate mates', () => {
    expect(badgeText({ ...none, wishlisted: true })?.label).toBe('wishlist');
    expect(badgeText({ ...none, wishlisted: true, crateMates: 2 })).toEqual({
      label: 'wishlist · 2 crate mates',
      hint: 'In your wishlist. 2 of your top 30 crate mates own this',
    });
  });

  it('says nothing when there is nothing to say', () => {
    expect(badgeText(none)).toBeNull();
  });
});
